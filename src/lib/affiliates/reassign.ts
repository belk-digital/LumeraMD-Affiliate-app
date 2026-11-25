import { prisma } from "@/lib/prisma";
import { computeUnilevel } from "@/lib/affiliates/unilevel";
import { updateAffiliateStats } from "@/lib/affiliates/stats";
import { round2 } from "@/lib/metrics";
import { createNotification } from "@/lib/notifications/create";
import { notifyAffiliateMoved } from "@/lib/email/notifications";

export class MoveError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const label = (a: { displayName: string | null; userEmail: string }) => a.displayName ?? a.userEmail;

/** The affiliate plus everyone below them, found level by level. */
async function teamIds(rootId: string): Promise<string[]> {
  const all = [rootId];
  const seen = new Set(all);
  let frontier = [rootId];
  for (let depth = 0; frontier.length > 0 && depth < 60; depth++) {
    const kids = await prisma.affiliate.findMany({
      where: { parentAffiliateId: { in: frontier } },
      select: { id: true },
    });
    frontier = kids.map((k) => k.id).filter((id) => !seen.has(id));
    frontier.forEach((id) => {
      seen.add(id);
      all.push(id);
    });
  }
  return all;
}

/**
 * Re-parents an affiliate (and so their whole team) under another affiliate, or to the top level (null).
 *
 * Everything that reads the tree uses parentAffiliateId live, so that is the one structural write. On top of it:
 *  - orders still in their pending period, from the moved affiliate and anyone below them, get their team
 *    overrides worked out again on the new chain. Approved, paid, reversed and voided orders are left alone,
 *    since those commissions may already have been paid out;
 *  - a history row records who moved whom and when;
 *  - the moved affiliate and both sponsors are told.
 */
export async function moveAffiliate(params: { id: string; parentId: string | null; adminEmail: string }) {
  const { id, parentId, adminEmail } = params;
  if (parentId === id) throw new MoveError("An affiliate can't report to themselves.", 400);

  const moving = await prisma.affiliate.findUnique({ where: { id } });
  if (!moving) throw new MoveError("Affiliate not found.", 404);
  if (moving.parentAffiliateId === parentId) return { unchanged: true as const };

  const target = parentId ? await prisma.affiliate.findUnique({ where: { id: parentId } }) : null;
  if (parentId) {
    if (!target) throw new MoveError("New parent not found.", 404);
    if (target.status !== "approved") {
      throw new MoveError("Affiliates can only be moved under an approved affiliate.", 400);
    }
    // Walk up from the new parent: reaching the moved affiliate means the target is in their own team.
    let cursor: string | null = target.id;
    for (let i = 0; cursor && i < 1000; i++) {
      if (cursor === id) throw new MoveError("Can't move someone under their own team.", 400);
      const up: { parentAffiliateId: string | null } | null = await prisma.affiliate.findUnique({
        where: { id: cursor },
        select: { parentAffiliateId: true },
      });
      cursor = up?.parentAffiliateId ?? null;
    }
  }
  const oldParent = moving.parentAffiliateId
    ? await prisma.affiliate.findUnique({ where: { id: moving.parentAffiliateId } })
    : null;

  await prisma.affiliate.update({ where: { id }, data: { parentAffiliateId: parentId } });

  // Pending orders from the moved affiliate's whole team: their uplines changed, so redo the overrides.
  const team = await teamIds(id);
  const pending = await prisma.affiliateConversion.findMany({
    where: { affiliateId: { in: team }, status: "pending", selfReferralDetected: false },
    include: { overrides: { select: { affiliateId: true } }, affiliate: true },
  });
  const settings = await prisma.affiliateSettings.upsert({ where: { id: "global" }, update: {}, create: { id: "global" } });
  const statsToRefresh = new Set<string>();

  for (const conv of pending) {
    // The seller is read fresh, so a seller whose own parent just changed uses the new one.
    const seller = conv.affiliate;
    for (const o of conv.overrides) statsToRefresh.add(o.affiliateId);
    if (conv.parentAffiliateId) statsToRefresh.add(conv.parentAffiliateId);

    if (settings.unilevelEnabled) {
      const outcome = await computeUnilevel({
        seller,
        eligibleSubtotal: conv.eligibleSubtotal,
        settings,
        at: conv.createdAt,
      });
      await prisma.$transaction([
        prisma.conversionOverride.deleteMany({ where: { conversionId: conv.id } }),
        prisma.conversionOverride.createMany({
          data: outcome.payouts.map((p) => ({ ...p, conversionId: conv.id })),
        }),
      ]);
      outcome.payouts.forEach((p) => statsToRefresh.add(p.affiliateId));
    } else {
      // Single-parent plan: the seller's current parent earns the override if approved.
      const parent = seller.parentAffiliateId
        ? await prisma.affiliate.findUnique({ where: { id: seller.parentAffiliateId } })
        : null;
      const live = parent && parent.status === "approved" ? parent : null;
      const rate = live ? (live.parentOverrideRate ?? settings.defaultParentOverrideRate) : null;
      await prisma.affiliateConversion.update({
        where: { id: conv.id },
        data: {
          parentAffiliateId: live?.id ?? null,
          parentCommissionRate: rate,
          parentCommissionAmount: rate === null ? null : round2((conv.eligibleSubtotal * rate) / 100),
        },
      });
      if (live) statsToRefresh.add(live.id);
    }
  }
  for (const aid of statsToRefresh) await updateAffiliateStats(aid);

  await prisma.affiliateMove.create({
    data: {
      affiliateId: id,
      affiliateName: label(moving),
      fromParentId: oldParent?.id ?? null,
      fromParentName: oldParent ? label(oldParent) : null,
      toParentId: target?.id ?? null,
      toParentName: target ? label(target) : null,
      teamSize: team.length - 1,
      pendingOrdersUpdated: pending.length,
      movedByEmail: adminEmail,
    },
  });

  // Tell the people affected. Failures here must not undo or hide a move that already happened.
  const note = async (a: typeof moving, role: "moved" | "gained" | "lost", other: string | null) => {
    const text = {
      moved: {
        title: target ? `You now report to ${label(target)}` : "You are now a top-level affiliate",
        body: "An administrator updated your place in the LumeraMD team structure.",
      },
      gained: { title: `${label(moving)} joined your team`, body: "An administrator moved them under you." },
      lost: { title: `${label(moving)} left your team`, body: "An administrator moved them to another team." },
    }[role];
    await createNotification(a.id, { type: "team_moved", ...text });
    await notifyAffiliateMoved(a, { role, movedName: label(moving), otherName: other });
  };
  try {
    await note(moving, "moved", target ? label(target) : null);
    if (target) await note(target, "gained", null);
    if (oldParent) await note(oldParent, "lost", null);
  } catch (err) {
    console.error("Move notifications failed", err);
  }

  console.info(
    `[hierarchy] ${adminEmail} moved ${id} from ${oldParent?.id ?? "top level"} to ${parentId ?? "top level"}; ${pending.length} pending orders updated`,
  );
  return { unchanged: false as const, pendingOrdersUpdated: pending.length, teamSize: team.length - 1 };
}
