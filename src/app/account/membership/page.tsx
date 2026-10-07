import { requireCustomer } from "@/lib/customers/requireCustomer";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_PLANS, PLANS, TEST_KIT_PRICE, type PlanKey } from "@/lib/membership/plans";
import Icon from "@/components/Icon";
import AccountShell from "../AccountShell";
import { affiliateIdFor } from "@/lib/customers/crossLinks";
import { Badge, ButtonLink, Card, DataTable, MEMBERSHIP_LABEL, MEMBERSHIP_TONE, Page, PageHeader, fmtDate, fmtDateLong, usd } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Membership · LumeraMD" };

const OPS_EMAIL = process.env.AFFILIATE_OPS_EMAIL ?? "info@lumeramd.com";

export default async function MembershipPage() {
  const customer = await requireCustomer();
  const plan = PLANS[customer.plan as PlanKey];
  const payments = await prisma.membershipPayment.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  const currentIndex = CUSTOMER_PLANS.findIndex((p) => p.key === customer.plan);

  return (
    <AccountShell
      name={`${customer.firstName} ${customer.lastName}`.trim()}
      email={customer.email}
      affiliateId={await affiliateIdFor(customer.email)}
    >
      <Page>
        <PageHeader title="Membership" subtitle="Your plan, benefits and payments." />

        <Card title="Current plan" icon="card">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <span className="font-heading text-3xl font-bold text-ink">{plan?.name ?? customer.plan}</span>
              {customer.complimentary ? <span className="ml-2 text-lg text-ink/55">Complimentary</span> : plan && <span className="ml-2 text-lg text-ink/55">{usd(plan.monthlyPrice)} / month</span>}
            </div>
            <Badge tone={MEMBERSHIP_TONE[customer.status] ?? "slate"}>{MEMBERSHIP_LABEL[customer.status] ?? customer.status}</Badge>
          </div>
          <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm text-ink/65 sm:grid-cols-2">
            {customer.activatedAt && (
              <div className="flex justify-between gap-3"><dt>Member since</dt><dd className="font-medium text-ink">{fmtDateLong(customer.activatedAt)}</dd></div>
            )}
            {customer.complimentary && customer.status !== "cancelled" && (
              <div className="flex justify-between gap-3"><dt>Billing</dt><dd className="font-medium text-ink">Complimentary, no payment needed</dd></div>
            )}
            {customer.currentPeriodEnd && customer.status !== "cancelled" && (
              <div className="flex justify-between gap-3"><dt>Paid through</dt><dd className="font-medium text-ink">{fmtDateLong(customer.currentPeriodEnd)}</dd></div>
            )}
            {customer.cancelledAt && (
              <div className="flex justify-between gap-3"><dt>Cancelled</dt><dd className="font-medium text-ink">{fmtDateLong(customer.cancelledAt)}</dd></div>
            )}
          </dl>
          {plan && (
            <ul className="mt-5 grid gap-2.5 text-sm text-ink/80 sm:grid-cols-2">
              {plan.benefits.map((b) => (
                <li key={b} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                    <Icon name="check" className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {currentIndex >= 0 && (
        <Card title="Compare plans" icon="pie">
          <div className="grid gap-4 md:grid-cols-3">
            {CUSTOMER_PLANS.map((p, i) => {
              const current = p.key === customer.plan;
              const verb = i > currentIndex ? "Request upgrade" : "Request downgrade";
              return (
                <div
                  key={p.key}
                  className={`flex min-w-0 flex-col rounded-2xl border p-4 ${current ? "border-primary bg-primary-light/40" : "border-line"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-heading text-lg font-semibold text-ink">{p.name}</h3>
                    {current && <Badge tone="blue">Current</Badge>}
                  </div>
                  <div className="mt-1 font-heading text-2xl font-bold text-ink">
                    {usd(p.monthlyPrice)}
                    <span className="text-sm font-normal text-ink/50"> / month</span>
                  </div>
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-ink/75">
                    {p.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={3} />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    {current ? (
                      <span className="block rounded-lg bg-white/70 px-4 py-2.5 text-center text-sm font-medium text-ink/50">Your plan</span>
                    ) : (
                      <ButtonLink
                        variant="outline"
                        href={`mailto:${OPS_EMAIL}?subject=${encodeURIComponent(`${verb}: ${p.name}`)}&body=${encodeURIComponent(`Hi, I'd like to switch to the ${p.name} plan. My membership email is ${customer.email}.`)}`}
                      >
                        {verb}
                      </ButtonLink>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-ink/45">
            Plan changes are handled by our team. Test kit list price is {usd(TEST_KIT_PRICE)}.
          </p>
        </Card>
        )}

        <Card title="Payments" icon="dollar">
          <DataTable
            headers={["Date", "Amount", "Period"]}
            align={["left", "right", "left"]}
            empty="No payments yet."
            rows={payments.map((p) => [
              fmtDate(p.createdAt),
              <span key={p.id} className="font-medium text-ink">{usd(p.amount)}</span>,
              `${fmtDate(p.periodStart)} – ${fmtDate(p.periodEnd)}`,
            ])}
          />
        </Card>
      </Page>
    </AccountShell>
  );
}
