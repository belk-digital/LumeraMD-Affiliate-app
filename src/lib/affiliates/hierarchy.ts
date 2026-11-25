import { prisma } from "@/lib/prisma";
import { activityRulesFromSettings } from "@/lib/affiliates/activity";
import { isAffiliateQualified, monthWindow, planFromSettings } from "@/lib/affiliates/unilevel";

const MAX_DEPTH = 50; // guard against runaway/cyclic chains
const MAX_NODES = 5000;
const COUNTED = ["pending", "approved", "paid"] as const;

export type HierarchyKind = "company" | "upline" | "self" | "member";

export interface HierarchyNode {
  id: string;
  name: string;
  kind: HierarchyKind;
  /** For uplines: 1 = nearest qualified upline, up to the number of paid override slots. */
  level?: number;
  status?: string;
  /** Admin tree only. */
  email?: string;
  /** Admin tree only: whether this affiliate may recruit (invite link, QR). */
  canRecruit?: boolean;
  /** Admin tree only: lifetime sales volume. */
  sales?: number;
  /** Everyone below this node. */
  teamSize: number;
  children: HierarchyNode[];
}

/** Other people's emails are never shown to an agent; this keeps just enough to recognise them. */
function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***${domain ? `@${domain}` : ""}`;
}

function countBelow(node: HierarchyNode): number {
  node.teamSize = node.children.reduce((sum, c) => sum + 1 + countBelow(c), 0);
  return node.teamSize;
}

/** Admin view: every affiliate, nested under whoever recruited them, with no depth limit. */
export async function getAdminHierarchy(): Promise<{
  root: HierarchyNode;
  totals: { affiliates: number; sales: number };
}> {
  const [rows, salesRows] = await Promise.all([
    prisma.affiliate.findMany({
      select: { id: true, displayName: true, userEmail: true, status: true, canRecruit: true, parentAffiliateId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.affiliateConversion.groupBy({
      by: ["affiliateId"],
      where: { status: { in: [...COUNTED] } },
      _sum: { eligibleSubtotal: true },
    }),
  ]);

  const sales = new Map(salesRows.map((s) => [s.affiliateId, s._sum.eligibleSubtotal ?? 0]));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const kids = new Map<string, string[]>();
  const roots: string[] = [];
  for (const r of rows) {
    if (r.parentAffiliateId && byId.has(r.parentAffiliateId)) {
      kids.set(r.parentAffiliateId, [...(kids.get(r.parentAffiliateId) ?? []), r.id]);
    } else {
      roots.push(r.id);
    }
  }

  const seen = new Set<string>();
  function build(id: string, depth: number): HierarchyNode {
    seen.add(id);
    const r = byId.get(id)!;
    const children =
      depth >= MAX_DEPTH
        ? []
        : (kids.get(id) ?? []).filter((c) => !seen.has(c)).map((c) => build(c, depth + 1));
    return {
      id,
      name: r.displayName ?? r.userEmail,
      email: r.userEmail,
      kind: "member",
      status: r.status,
      canRecruit: r.canRecruit,
      sales: sales.get(id) ?? 0,
      teamSize: 0,
      children,
    };
  }

  const children = roots.map((id) => build(id, 1));
  // A recruiter loop leaves people unreachable from any top; surface them rather than lose them.
  for (const r of rows) if (!seen.has(r.id)) children.push(build(r.id, 1));

  const total = [...sales.values()].reduce((a, b) => a + b, 0);
  const root: HierarchyNode = {
    id: "company",
    name: "LumeraMD",
    kind: "company",
    teamSize: 0,
    children,
  };
  countBelow(root);
  return { root, totals: { affiliates: rows.length, sales: total } };
}

/**
 * Agent view. One tree: the agent's qualified uplines above (at most as many as there are paid
 * override slots, nearest first, found the same way payouts find them), the agent in the middle,
 * and the agent's own team below. Uplines who don't currently qualify are skipped, exactly as they
 * are for payouts. Only names and status leave the server; no emails, sales or earnings.
 */
export async function getAgentHierarchy(affiliateId: string): Promise<{
  root: HierarchyNode;
  uplineCount: number;
  maxUplines: number;
} | null> {
  const self = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
  if (!self) return null;

  const settings = await prisma.affiliateSettings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });
  const plan = planFromSettings(settings);
  const activity = activityRulesFromSettings(settings);
  const window = monthWindow(new Date());
  const maxUplines = plan.overrideSlotRates.length;

  // Walk up the recruiter chain, keeping only qualified uplines, until the slots are full.
  const uplines: HierarchyNode[] = [];
  const seen = new Set([self.id]);
  let nextId = self.parentAffiliateId;
  for (let depth = 0; nextId && !seen.has(nextId) && depth < MAX_DEPTH && uplines.length < maxUplines; depth++) {
    seen.add(nextId);
    const upline = await prisma.affiliate.findUnique({ where: { id: nextId } });
    if (!upline) break;
    if (await isAffiliateQualified(upline, plan, window, activity)) {
      uplines.push({
        id: upline.id,
        name: upline.displayName ?? maskEmail(upline.userEmail),
        kind: "upline",
        level: uplines.length + 1,
        teamSize: 0,
        children: [],
      });
    }
    nextId = upline.parentAffiliateId;
  }

  // The agent's own team, level by level.
  const selfNode: HierarchyNode = {
    id: self.id,
    name: self.displayName ?? maskEmail(self.userEmail),
    kind: "self",
    status: self.status,
    teamSize: 0,
    children: [],
  };
  const nodes = new Map<string, HierarchyNode>([[self.id, selfNode]]);
  let frontier = [self.id];
  for (let depth = 0; frontier.length > 0 && depth < MAX_DEPTH && nodes.size < MAX_NODES; depth++) {
    const recruits = await prisma.affiliate.findMany({
      where: { parentAffiliateId: { in: frontier }, status: { in: ["approved", "suspended"] } },
      select: { id: true, displayName: true, userEmail: true, status: true, parentAffiliateId: true },
      orderBy: { createdAt: "asc" },
    });
    frontier = [];
    for (const r of recruits) {
      if (nodes.has(r.id)) continue;
      const node: HierarchyNode = {
        id: r.id,
        name: r.displayName ?? maskEmail(r.userEmail),
        kind: "member",
        status: r.status,
        teamSize: 0,
        children: [],
      };
      nodes.set(r.id, node);
      nodes.get(r.parentAffiliateId!)?.children.push(node);
      frontier.push(r.id);
    }
  }

  // uplines is nearest-first; chain them top-down so the furthest sits at the root.
  let top = selfNode;
  for (const u of uplines) {
    u.children = [top];
    top = u;
  }
  countBelow(top);

  return { root: top, uplineCount: uplines.length, maxUplines };
}
