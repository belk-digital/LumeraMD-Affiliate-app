import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import StatusPill from "@/components/StatusPill";
import { PLANS, TEST_KIT_PRICE, type PlanKey } from "@/lib/membership/plans";
import SalesRepActions from "./SalesRepActions";
import CustomerActions from "./CustomerActions";
import { getCustomerBalances } from "@/lib/wallet/ledger";
import { formatPoints } from "@/lib/wallet/rules";

export const dynamic = "force-dynamic";

const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const date = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const th = "px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-ink/50";
const td = "px-4 py-3 text-sm text-ink/80 align-top";

export default async function SignupsPage() {
  await requireAdminPage();

  const [reps, customers, referrers] = await Promise.all([
    prisma.salesRepSignup.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.customerSignup.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { payments: { orderBy: { createdAt: "desc" }, take: 12 } },
    }),
    prisma.affiliate.findMany({ select: { id: true, displayName: true, userEmail: true } }),
  ]);
  const referrerName = new Map(referrers.map((r) => [r.id, r.displayName ?? r.userEmail]));
  const walletBalances = await getCustomerBalances(customers.map((c) => c.email));

  return (
    <div className="space-y-8 p-4 md:p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Signups</h1>
        <p className="mt-1 text-sm text-ink/60">
          People who signed up through the public sales rep and customer membership pages.
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-heading text-base font-semibold text-ink">
          Sales reps <span className="font-normal text-ink/40">({reps.length})</span>
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
          <table className="min-w-full divide-y divide-line">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Contact</th>
                <th className={th}>Annual gross sales</th>
                <th className={th}>Type of sales</th>
                <th className={th}>Resume</th>
                <th className={th}>Referred by</th>
                <th className={th}>Signed up</th>
                <th className={th}>Status</th>
                <th className={th}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {reps.length === 0 && (
                <tr>
                  <td className={td} colSpan={9}>
                    No sales rep signups yet.
                  </td>
                </tr>
              )}
              {reps.map((r) => (
                <tr key={r.id}>
                  <td className={td}>{[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}</td>
                  <td className={td}>
                    <div>{r.email}</div>
                    {r.phone && <div className="text-xs text-ink/50">{r.phone}</div>}
                  </td>
                  <td className={td}>{r.annualGrossSales != null ? usd(r.annualGrossSales) : "—"}</td>
                  <td className={td}>{r.salesType ?? "—"}</td>
                  <td className={td}>
                    {r.resumeStorageKey ? (
                      <a
                        href={`/api/lumera-ops/sales-reps/${r.id}/resume`}
                        className="font-medium text-primary hover:underline"
                      >
                        Download
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={td}>
                    {r.referredByAffiliateId ? (referrerName.get(r.referredByAffiliateId) ?? "—") : "—"}
                  </td>
                  <td className={td}>{date(r.createdAt)}</td>
                  <td className={td}>
                    <StatusPill status={r.status} />
                  </td>
                  <td className={td}>
                    <SalesRepActions
                      rep={{
                        id: r.id,
                        name: [r.firstName, r.lastName].filter(Boolean).join(" ") || r.email.split("@")[0],
                        email: r.email,
                        phone: r.phone,
                        annualGrossSales: r.annualGrossSales,
                        salesType: r.salesType,
                        plan: r.plan
                          ? PLANS[r.plan as PlanKey]
                            ? `${PLANS[r.plan as PlanKey].name} · ${usd(PLANS[r.plan as PlanKey].monthlyPrice)}/mo`
                            : r.plan
                          : null,
                        hasResume: !!r.resumeStorageKey,
                        referrer: r.referredByAffiliateId ? (referrerName.get(r.referredByAffiliateId) ?? null) : null,
                        signedUp: date(r.createdAt),
                        status: r.status,
                        reviewNotes: r.reviewNotes,
                        linkedAffiliateId: r.linkedAffiliateId,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-base font-semibold text-ink">
          Customer memberships <span className="font-normal text-ink/40">({customers.length})</span>
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
          <table className="min-w-full divide-y divide-line">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Contact</th>
                <th className={th}>Plan</th>
                <th className={th}>Test kit</th>
                <th className={th}>Points</th>
                <th className={th}>Status</th>
                <th className={th}>Referred by</th>
                <th className={th}>Signed up</th>
                <th className={th}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {customers.length === 0 && (
                <tr>
                  <td className={td} colSpan={9}>
                    No customer signups yet.
                  </td>
                </tr>
              )}
              {customers.map((c) => {
                const plan = PLANS[c.plan as PlanKey];
                return (
                  <tr key={c.id}>
                    <td className={td}>
                      {c.firstName} {c.lastName}
                    </td>
                    <td className={td}>
                      <div>{c.email}</div>
                      {c.phone && <div className="text-xs text-ink/50">{c.phone}</div>}
                    </td>
                    <td className={td}>
                      {plan ? `${plan.name} · ${usd(plan.monthlyPrice)}/mo` : c.plan}
                    </td>
                    <td className={td}>{c.wantsTestKit ? `Yes (${usd(plan?.testKitPrice ?? TEST_KIT_PRICE)})` : "—"}</td>
                    <td className={td}>{formatPoints(walletBalances.get(c.email.toLowerCase()) ?? 0)}</td>
                    <td className={td}>
                      <StatusPill status={c.status} />
                      {c.status === "active" && c.currentPeriodEnd && (
                        <div className="mt-1 text-xs text-ink/50">through {date(c.currentPeriodEnd)}</div>
                      )}
                    </td>
                    <td className={td}>
                      {c.referredByAffiliateId ? (referrerName.get(c.referredByAffiliateId) ?? "—") : "—"}
                    </td>
                    <td className={td}>{date(c.createdAt)}</td>
                    <td className={td}>
                      <CustomerActions
                        customer={{
                          id: c.id,
                          name: `${c.firstName} ${c.lastName}`.trim(),
                          email: c.email,
                          phone: c.phone,
                          planName: plan?.name ?? c.plan,
                          monthlyPrice: plan?.monthlyPrice ?? 0,
                          discountPercent: plan?.webDiscountPercent ?? 0,
                          wantsTestKit: c.wantsTestKit,
                          testKitPrice: plan?.testKitPrice ?? TEST_KIT_PRICE,
                          status: c.status,
                          referrer: c.referredByAffiliateId
                            ? (referrerName.get(c.referredByAffiliateId) ?? null)
                            : null,
                          signedUp: date(c.createdAt),
                          currentPeriodEnd: c.currentPeriodEnd ? date(c.currentPeriodEnd) : null,
                          memberDiscountCode: c.memberDiscountCode,
                          memberDiscountActive: c.memberDiscountActive,
                          consultationsUsed: c.consultationsUsed,
                          consultationsIncluded: plan?.consultations ?? 0,
                          payments: c.payments.map((p) => ({
                            id: p.id,
                            amount: p.amount,
                            paidOn: date(p.createdAt),
                            coversThrough: date(p.periodEnd),
                            note: p.note,
                          })),
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
