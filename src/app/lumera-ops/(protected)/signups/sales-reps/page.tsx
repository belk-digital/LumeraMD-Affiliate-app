import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import {
  DAY_MS,
  SIGNUPS_PAGE_SIZE,
  parseSignupQuery,
  planLabel,
  repWhere,
  trendPercent,
} from "@/lib/admin/signupFilters";
import type { PlanKey } from "@/lib/membership/plans";
import { getCatalog } from "@/lib/membership/plans.server";
import { authnetConfigured } from "@/lib/authnet/client";
import { shortDate, usd } from "../_components/fmt";
import RepsClient from "./RepsClient";
import type { CountStat, RepData } from "./types";

export const dynamic = "force-dynamic";

const APP_BASE_URL = process.env.APP_BASE_URL ?? "";

async function countWithTrend(where: Prisma.SalesRepSignupWhereInput): Promise<CountStat> {
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY_MS);
  const since60 = new Date(now - 60 * DAY_MS);
  const [total, current, previous] = await Promise.all([
    prisma.salesRepSignup.count({ where }),
    prisma.salesRepSignup.count({ where: { ...where, createdAt: { gte: since30 } } }),
    prisma.salesRepSignup.count({ where: { ...where, createdAt: { gte: since60, lt: since30 } } }),
  ]);
  return { total, trend: trendPercent(current, previous) };
}

export default async function SalesRepsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdminPage();

  const query = parseSignupQuery(await searchParams);
  const where = repWhere(query);

  const [rows, totalFiltered, all, pending, approved, rejected] = await Promise.all([
    prisma.salesRepSignup.findMany({
      where,
      orderBy: { createdAt: query.sort === "oldest" ? "asc" : "desc" },
      skip: (query.page - 1) * SIGNUPS_PAGE_SIZE,
      take: SIGNUPS_PAGE_SIZE,
    }),
    prisma.salesRepSignup.count({ where }),
    countWithTrend({}),
    countWithTrend({ status: "pending" }),
    countWithTrend({ status: "approved" }),
    countWithTrend({ status: "rejected" }),
  ]);

  const referrerIds = [...new Set(rows.map((r) => r.referredByAffiliateId).filter((id): id is string => !!id))];
  const [referrers, memberships] = await Promise.all([
    prisma.affiliate.findMany({
      where: { id: { in: referrerIds } },
      select: { id: true, displayName: true, userEmail: true },
    }),
    // An approved rep also has their own Premium membership to pay for.
    prisma.customerSignup.findMany({
      where: { plan: "agent", email: { in: rows.map((r) => r.email), mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const referrerName = new Map(referrers.map((r) => [r.id, r.displayName ?? r.userEmail]));
  const membershipByEmail = new Map<string, (typeof memberships)[number]>();
  for (const m of memberships) if (!membershipByEmail.has(m.email.toLowerCase())) membershipByEmail.set(m.email.toLowerCase(), m);
  const online = authnetConfigured();

  const catalog = await getCatalog();
  const reps: RepData[] = rows.map((r) => {
    const plan = r.plan ? catalog.plans[r.plan as PlanKey] : undefined;
    const member = r.linkedAffiliateId ? membershipByEmail.get(r.email.toLowerCase()) : undefined;
    return {
      id: r.id,
      name: [r.firstName, r.lastName].filter(Boolean).join(" ") || r.email.split("@")[0],
      email: r.email,
      phone: r.phone,
      annualGrossSales: r.annualGrossSales,
      salesType: r.salesType,
      plan: r.plan ? (plan ? `${planLabel(r.plan, catalog.plans)} · ${usd(plan.monthlyPrice)}/mo` : r.plan) : null,
      hasResume: !!r.resumeStorageKey,
      resumeFileName: r.resumeFileName,
      referrer: r.referredByAffiliateId ? (referrerName.get(r.referredByAffiliateId) ?? null) : null,
      appliedOn: shortDate(r.createdAt),
      status: r.status,
      reviewNotes: r.reviewNotes,
      linkedAffiliateId: r.linkedAffiliateId,
      membership: member
        ? {
            status: member.status,
            payLink:
              online && (member.status === "pending_payment" || member.status === "past_due")
                ? `${APP_BASE_URL}/pay/${member.id}`
                : null,
          }
        : null,
    };
  });

  return (
    <RepsClient
      reps={reps}
      totalFiltered={totalFiltered}
      stats={{ all, pending, approved, rejected }}
      query={query}
      pageSize={SIGNUPS_PAGE_SIZE}
    />
  );
}
