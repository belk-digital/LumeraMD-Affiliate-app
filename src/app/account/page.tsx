import { requireCustomer } from "@/lib/customers/requireCustomer";
import { PLANS, TEST_KIT_PRICE, type PlanKey } from "@/lib/membership/plans";
import { getWalletSummary } from "@/lib/wallet/ledger";
import { getWalletRules } from "@/lib/wallet/service";
import { formatPoints } from "@/lib/wallet/rules";
import Icon from "@/components/Icon";
import AccountShell from "./AccountShell";
import { affiliateIdFor } from "@/lib/customers/crossLinks";
import { CopyCode } from "./AccountClient";
import {
  Badge,
  ButtonLink,
  Card,
  DataTable,
  MEMBERSHIP_LABEL,
  MEMBERSHIP_TONE,
  Page,
  PointsDelta,
  StatCard,
  fmtDate,
  fmtDateLong,
  usd,
} from "./ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "My membership · LumeraMD" };

const OPS_EMAIL = process.env.AFFILIATE_OPS_EMAIL ?? "info@lumeramd.com";

export default async function AccountOverviewPage() {
  const customer = await requireCustomer();
  const plan = PLANS[customer.plan as PlanKey];
  const planName = plan?.name ?? customer.plan;
  const isActive = customer.status === "active";

  const [rules, wallet] = await Promise.all([
    getWalletRules(),
    getWalletSummary("customer", customer.email, 5),
  ]);
  const included = plan?.consultations ?? 0;
  const left = Math.max(included - customer.consultationsUsed, 0);
  const kitPrice = plan?.testKitPrice ?? TEST_KIT_PRICE;
  const walletAvailable = rules.enabled || wallet.accountId !== null;

  const statusLine: Record<string, string> = {
    pending_payment: "Waiting for your first payment. We'll email you when it's active.",
    active: customer.complimentary ? "Complimentary membership: no payment needed." : customer.currentPeriodEnd ? `Active through ${fmtDateLong(customer.currentPeriodEnd)}.` : "Your membership is active.",
    past_due: "Your payment is overdue, so your member discount is paused.",
    cancelled: customer.cancelledAt ? `Cancelled on ${fmtDateLong(customer.cancelledAt)}.` : "This membership was cancelled.",
  };

  return (
    <AccountShell
      name={`${customer.firstName} ${customer.lastName}`.trim()}
      email={customer.email}
      affiliateId={await affiliateIdFor(customer.email)}
    >
      <Page>
        <div className="animate-fade-up relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-[#2c5a86] p-6 text-white md:p-8">
          <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-white/5" />
          <h1 className="relative font-heading text-3xl font-bold md:text-4xl">Hi {customer.firstName}</h1>
          <p className="relative mt-1 text-sm text-white/75">Here&apos;s your LumeraMD membership.</p>
        </div>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon="card"
            label="Membership"
            badge={<Badge tone={MEMBERSHIP_TONE[customer.status] ?? "slate"}>{MEMBERSHIP_LABEL[customer.status] ?? customer.status}</Badge>}
            value={planName}
            sub={
              <>
                {customer.complimentary ? "Complimentary" : plan ? `${usd(plan.monthlyPrice)} / month` : ""}
                {customer.status === "active" && customer.currentPeriodEnd && (
                  <span className="block">Active through {fmtDate(customer.currentPeriodEnd)}</span>
                )}
              </>
            }
          />
          <StatCard
            icon="wallet"
            label="Wallet Balance"
            value={walletAvailable ? formatPoints(wallet.balanceCents) : "—"}
            suffix={walletAvailable ? "points" : undefined}
            sub={walletAvailable ? `Worth $${formatPoints(wallet.balanceCents)} in store credit` : "Coming soon"}
          />
          <StatCard
            icon="calendar"
            label="Consultations"
            value={included > 0 ? `${customer.consultationsUsed} of ${included} used` : "—"}
            sub={included > 0 ? `${left} left` : "Not included in your plan"}
          />
          <StatCard
            icon="flask"
            label="DNA Test Kit"
            value={
              <>
                {usd(kitPrice)}
                {kitPrice < TEST_KIT_PRICE && <span className="ml-2 text-sm font-normal text-ink/40 line-through">{usd(TEST_KIT_PRICE)}</span>}
              </>
            }
            sub={plan?.testKitPrice !== undefined ? `${planName} member price` : "Web price"}
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card
            title="Your membership"
            icon="card"
            action={{ href: "/account/membership", label: "Manage" }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="font-heading text-3xl font-bold text-ink">{planName}</span>
                {customer.complimentary ? <span className="ml-2 text-lg text-ink/55">Complimentary</span> : plan && <span className="ml-2 text-lg text-ink/55">{usd(plan.monthlyPrice)} / month</span>}
              </div>
              <Badge tone={MEMBERSHIP_TONE[customer.status] ?? "slate"}>{MEMBERSHIP_LABEL[customer.status] ?? customer.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-ink/60">{statusLine[customer.status]}</p>
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

          <div className="space-y-5">
            {customer.memberDiscountActive && customer.memberDiscountCode ? (
              <Card title="Member discount" icon="dollar" className="border-emerald-200 bg-emerald-50/40">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-ink/70">{plan?.webDiscountPercent}% off web pricing</span>
                  <Badge tone="green">Active</Badge>
                </div>
                <CopyCode code={customer.memberDiscountCode} />
              </Card>
            ) : (
              <Card title="Member discount" icon="dollar" className="border-rose-200 bg-rose-50/50">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">Your code is paused</span>
                  <Badge tone="red">Paused</Badge>
                </div>
                <p className="text-sm text-ink/60">It comes back as soon as your membership is active.</p>
              </Card>
            )}

            <Card title="Recent activity" icon="chart" action={{ href: "/account/wallet", label: "View all" }}>
              <DataTable
                headers={["Description", "Date", "Points", "Balance"]}
                align={["left", "left", "right", "right"]}
                empty="Your wallet activity will appear here."
                rows={wallet.transactions.map((t) => [
                  <span key={t.id} className="font-medium text-ink">{t.reason ?? t.type}</span>,
                  fmtDate(t.createdAt),
                  <PointsDelta key={`p${t.id}`} cents={t.amountCents} />,
                  formatPoints(t.balanceAfterCents),
                ])}
              />
            </Card>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <Card title="Consultations" icon="calendar">
            {included > 0 ? (
              <>
                <div className="font-heading text-2xl font-semibold text-ink">
                  {customer.consultationsUsed} <span className="text-base font-normal text-ink/50">of {included} used,</span> {left}{" "}
                  <span className="text-base font-normal text-ink/50">left.</span>
                </div>
                <p className="mt-2 text-sm text-ink/60">
                  To book a consultation, email{" "}
                  <a href={`mailto:${OPS_EMAIL}`} className="font-medium text-primary hover:underline">{OPS_EMAIL}</a>.
                </p>
                <div className="mt-4">
                  <ButtonLink href={`mailto:${OPS_EMAIL}?subject=Book%20a%20consultation`} variant="outline">
                    <Icon name="mail" className="h-4 w-4" /> Email to book
                  </ButtonLink>
                </div>
              </>
            ) : (
              <p className="text-sm text-ink/60">
                Your plan doesn&apos;t include consultations. Plus includes 1 and Premium includes 2.{" "}
                <a href="/account/membership" className="font-medium text-primary hover:underline">See plans</a>
              </p>
            )}
          </Card>

          <Card title="DNA test kit" icon="flask">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-heading text-3xl font-bold text-ink">{usd(kitPrice)}</span>
              {kitPrice < TEST_KIT_PRICE && <span className="text-base text-ink/40 line-through">{usd(TEST_KIT_PRICE)}</span>}
            </div>
            <p className="mt-2 text-sm text-ink/60">
              {plan?.testKitPrice !== undefined
                ? `${planName} members get the test kit for ${usd(kitPrice)}.`
                : `Test kits are ${usd(TEST_KIT_PRICE)}. Plus members pay ${usd(PLANS.customer_plus.testKitPrice ?? TEST_KIT_PRICE)} and Premium ${usd(PLANS.customer_premium.testKitPrice ?? TEST_KIT_PRICE)}.`}
            </p>
            <div className="mt-4">
              <ButtonLink href="/account/test-kit">View test kit</ButtonLink>
            </div>
          </Card>
        </section>
        {!isActive && customer.status === "pending_payment" && (
          <p className="text-center text-xs text-ink/45">Questions? Email {OPS_EMAIL}</p>
        )}
      </Page>
    </AccountShell>
  );
}
