import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import { portalWebhookConfigured } from "@/lib/portal/events";
import {
  oidcClientId,
  oidcConfigured,
  oidcIssuer,
  oidcMissing,
  oidcPostLogoutUris,
  oidcRedirectUris,
} from "@/lib/oidc/config";
import { shortDate } from "../signups/_components/fmt";
import PortalClient, { type KeyRow } from "./PortalClient";
import type { EventRow } from "./Deliveries";

export const dynamic = "force-dynamic";

const APP_BASE_URL = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
const PAGE_SIZE = 10;
const STATUSES = ["delivered", "pending", "failed"] as const;

function hostOf(url: string | undefined) {
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
}

/** Dates in this page are shown in UTC, so what the server renders is what the browser shows. */
const stamp = (d: Date) =>
  `${d.toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} UTC`;

const sentLast24Hours = () =>
  prisma.portalEvent.groupBy({
    by: ["status"],
    where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    _count: { _all: true },
  });

/** The member's email, read from the notification that was sent. */
function emailOf(payload: unknown): string | null {
  const email = (payload as { data?: { member?: { email?: unknown } } } | null)?.data?.member?.email;
  return typeof email === "string" ? email : null;
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdminPage();

  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const status = STATUSES.find((s) => s === one(params.status)) ?? "";
  const page = Math.max(1, parseInt(one(params.page) ?? "1", 10) || 1);
  const where: Prisma.PortalEventWhereInput = status ? { status } : {};

  const [keys, sent, events, eventTotal] = await Promise.all([
    prisma.portalApiKey.findMany({ orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }] }),
    sentLast24Hours(),
    prisma.portalEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.portalEvent.count({ where }),
  ]);

  const count = (s: string) => sent.find((x) => x.status === s)?._count._all ?? 0;
  const keyRows: KeyRow[] = keys.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    createdBy: k.createdBy,
    created: shortDate(k.createdAt),
    lastUsed: k.lastUsedAt ? shortDate(k.lastUsedAt) : null,
    revoked: k.revokedAt ? shortDate(k.revokedAt) : null,
  }));
  const eventRows: EventRow[] = events.map((e) => ({
    id: e.id,
    type: e.type,
    status: e.status,
    attempts: e.attempts,
    lastError: e.lastError,
    email: emailOf(e.payload),
    created: stamp(e.createdAt),
    delivered: e.deliveredAt ? stamp(e.deliveredAt) : null,
    nextAttempt: e.status === "pending" ? stamp(e.nextAttemptAt) : null,
    payload: JSON.stringify(e.payload, null, 2),
  }));

  return (
    <PortalClient
      keys={keyRows}
      events={eventRows}
      eventTotal={eventTotal}
      eventQuery={{ status, page }}
      pageSize={PAGE_SIZE}
      webhook={{
        configured: portalWebhookConfigured(),
        host: hostOf(process.env.PORTAL_WEBHOOK_URL),
        delivered: count("delivered"),
        retrying: count("pending"),
        failed: count("failed"),
      }}
      docsUrl={`${APP_BASE_URL}/developers`}
      baseUrl={APP_BASE_URL || "https://lumeramd.biz"}
      sso={{
        configured: oidcConfigured(),
        missing: oidcMissing(),
        issuer: oidcIssuer(),
        discoveryUrl: `${oidcIssuer()}/.well-known/openid-configuration`,
        clientId: oidcClientId(),
        redirectUris: oidcRedirectUris(),
        logoutUris: oidcPostLogoutUris().length,
      }}
    />
  );
}
