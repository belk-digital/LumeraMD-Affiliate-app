import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import {
  DAY_MS,
  SIGNUPS_PAGE_SIZE,
  customerWhere,
  parseSignupQuery,
  planLabel,
  trendPercent,
} from "@/lib/admin/signupFilters";
import { PLANS, TEST_KIT_PRICE, type PlanKey } from "@/lib/membership/plans";
import { authnetConfigured } from "@/lib/authnet/client";
import { getCustomerBalances } from "@/lib/wallet/ledger";
import { shortDate } from "../_components/fmt";
import CustomersClient from "./CustomersClient";
import type { CountStat, CustomerData } from "./types";

export const dynamic = "force-dynamic";

const APP_BASE_URL = process.env.APP_BASE_URL ?? "";

async function countWithTrend(where: Prisma.CustomerSignupWhereInput): Promise<CountStat> {
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY_MS);
  const since60 = new Date(now - 60 * DAY_MS);
  const [total, current, previous] = await Promise.all([
    prisma.customerSignup.count({ where }),
    prisma.customerSignup.count({ where: { ...where, createdAt: { gte: since30 } } }),
    prisma.customerSignup.count({ where: { ...where, createdAt: { gte: since60, lt: since30 } } }),
  ]);
  return { total, trend: trendPercent(current, previous) };
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdminPage();

  const query = parseSignupQuery(await searchParams);
  const where = customerWhere(query);

  const [rows, totalFiltered, all, active, awaitingPayment, lapsed] = await Promise.all([
    prisma.customerSignup.findMany({
      where,
      orderBy: { createdAt: query.sort === "oldest" ? "asc" : "desc" },
      skip: (query.page - 1) * SIGNUPS_PAGE_SIZE,
      take: SIGNUPS_PAGE_SIZE,
      include: { payments: { orderBy: { createdAt: "desc" }, take: 12 } },
    }),
    prisma.customerSignup.count({ where }),
    countWithTrend({}),
    countWithTrend({ status: "active" }),
    countWithTrend({ status: "pending_payment" }),
    countWithTrend({ status: { in: ["past_due", "cancelled"] } }),
  ]);

  const referrerIds = [...new Set(rows.map((r) => r.referredByAffiliateId).filter((id): id is string => !!id))];
  const [referrers, balances] = await Promise.all([
    prisma.affiliate.findMany({
      where: { id: { in: referrerIds } },
      select: { id: true, displayName: true, userEmail: true },
    }),
    getCustomerBalances(rows.map((r) => r.email)),
  ]);
  const referrerName = new Map(referrers.map((r) => [r.id, r.displayName ?? r.userEmail]));
  const online = authnetConfigured();

  const customers: CustomerData[] = rows.map((c) => {
    const plan = PLANS[c.plan as PlanKey];
    return {
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      email: c.email,
      phone: c.phone,
      planLabel: planLabel(c.plan),
      planName: plan?.name ?? c.plan,
      monthlyPrice: plan?.monthlyPrice ?? 0,
      discountPercent: plan?.webDiscountPercent ?? 0,
      benefits: plan?.benefits ?? [],
      wantsTestKit: c.wantsTestKit,
      testKitPrice: plan?.testKitPrice ?? TEST_KIT_PRICE,
      status: c.status,
      referrer: c.referredByAffiliateId ? (referrerName.get(c.referredByAffiliateId) ?? null) : null,
      signedUp: shortDate(c.createdAt),
      currentPeriodEnd: c.currentPeriodEnd ? shortDate(c.currentPeriodEnd) : null,
      memberDiscountCode: c.memberDiscountCode,
      memberDiscountActive: c.memberDiscountActive,
      consultationsUsed: c.consultationsUsed,
      consultationsIncluded: plan?.consultations ?? 0,
      complimentary: c.complimentary,
      complimentaryNote: c.complimentaryNote,
      complimentaryBy: c.complimentaryBy,
      pointsCents: balances.get(c.email.toLowerCase()) ?? 0,
      payLink: online && (c.status === "pending_payment" || c.status === "past_due") ? `${APP_BASE_URL}/pay/${c.id}` : null,
      subscriptionId: c.authnetSubscriptionId,
      payments: c.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        paidOn: shortDate(p.createdAt),
        coversThrough: shortDate(p.periodEnd),
        note: p.note,
        source: p.source,
      })),
    };
  });

  return (
    <CustomersClient
      customers={customers}
      totalFiltered={totalFiltered}
      stats={{ all, active, awaitingPayment, lapsed }}
      query={query}
      pageSize={SIGNUPS_PAGE_SIZE}
    />
  );
}
