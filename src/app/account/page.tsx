import Link from "next/link";
import { redirect } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import StatusPill from "@/components/StatusPill";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customers/session";
import { PLANS, TEST_KIT_PRICE, type PlanKey } from "@/lib/membership/plans";
import { CopyCode, LogoutButton } from "./AccountClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "My membership · LumeraMD" };

const OPS_EMAIL = process.env.AFFILIATE_OPS_EMAIL ?? "info@lumeramd.com";
// Set these once the test kit exists in the store (see README notes): the product page, and the
// code that gives Premium members their $499 price.
const TEST_KIT_URL = process.env.TEST_KIT_URL;
const PREMIUM_TEST_KIT_CODE = process.env.PREMIUM_TEST_KIT_CODE;

const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const date = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-3 font-heading text-base font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default async function AccountPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");

  const customer = await prisma.customerSignup.findUnique({
    where: { id: session.customerId },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 12 } },
  });
  if (!customer) redirect("/account/login");

  const plan = PLANS[customer.plan as PlanKey];
  const planName = plan?.name ?? customer.plan;
  const isActive = customer.status === "active";
  const isPremium = customer.plan === "customer_premium";
  const kitPrice = plan?.testKitPrice ?? TEST_KIT_PRICE;
  const included = plan?.consultations ?? 0;

  const statusMessage: Record<string, string> = {
    pending_payment:
      "Your membership is waiting for its first payment. We'll email you the moment it's active.",
    active: customer.currentPeriodEnd
      ? `Active through ${date(customer.currentPeriodEnd)}.`
      : "Your membership is active.",
    past_due: customer.currentPeriodEnd
      ? `Your payment was due ${date(customer.currentPeriodEnd)}. Your member discount is paused until it's paid.`
      : "Your payment is overdue. Your member discount is paused until it's paid.",
    cancelled: customer.cancelledAt
      ? `Cancelled on ${date(customer.cancelledAt)}.`
      : "This membership was cancelled.",
  };

  return (
    <div className="min-h-screen bg-page-bg">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" aria-label="LumeraMD home">
            <BrandLogo className="-my-3 h-20 w-20" />
          </Link>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6">
        <div className="animate-fade-up">
          <h1 className="font-heading text-2xl font-semibold text-ink">
            Hi {customer.firstName}
          </h1>
          <p className="mt-1 text-sm text-ink/60">Here&apos;s your LumeraMD membership.</p>
        </div>

        <Card title="Your membership">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-heading text-xl font-semibold text-ink">{planName}</div>
              {plan && (
                <div className="text-sm text-ink/60">
                  {usd(plan.monthlyPrice)}
                  <span className="text-ink/40"> / month</span>
                </div>
              )}
            </div>
            <StatusPill status={customer.status} />
          </div>
          <p className="mt-3 text-sm text-ink/70">{statusMessage[customer.status]}</p>
          {customer.status === "cancelled" && (
            <Link
              href="/customers/signup"
              className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
            >
              Rejoin
            </Link>
          )}
          {plan && (
            <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm text-ink/70">
              {plan.benefits.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-primary">✓</span>
                  {b}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Member discount">
          {customer.memberDiscountActive && customer.memberDiscountCode ? (
            <>
              <CopyCode code={customer.memberDiscountCode} />
              <p className="mt-3 text-sm text-ink/60">
                Enter this code at checkout on lumeramd.com for {plan?.webDiscountPercent}% off.
              </p>
            </>
          ) : (
            <p className="text-sm text-ink/60">
              {customer.status === "pending_payment"
                ? `Your personal ${plan?.webDiscountPercent}% discount code appears here once your membership is active.`
                : "Your discount code is paused. It comes back as soon as your membership is active."}
            </p>
          )}
        </Card>

        {included > 0 && (
          <Card title="Consultations">
            <div className="flex items-center gap-2">
              {Array.from({ length: included }).map((_, i) => (
                <span
                  key={i}
                  className={`h-3 w-10 rounded-full ${i < customer.consultationsUsed ? "bg-primary" : "bg-primary-light"}`}
                />
              ))}
            </div>
            <p className="mt-3 text-sm text-ink/70">
              {customer.consultationsUsed} of {included} used
              {isActive && customer.consultationsUsed < included
                ? `, ${included - customer.consultationsUsed} left`
                : ""}
              .
            </p>
            <p className="mt-1 text-xs text-ink/45">
              To book a consultation, email{" "}
              <a href={`mailto:${OPS_EMAIL}`} className="font-medium text-primary hover:underline">
                {OPS_EMAIL}
              </a>
              .
            </p>
          </Card>
        )}

        <Card title="DNA test kit">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-heading text-2xl font-semibold text-ink">{usd(kitPrice)}</span>
            {kitPrice < TEST_KIT_PRICE && (
              <span className="text-sm text-ink/45 line-through">{usd(TEST_KIT_PRICE)}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink/60">
            {isPremium
              ? "Premium members get the test kit for $499."
              : `Test kits are ${usd(TEST_KIT_PRICE)}. Premium members pay $499.`}
          </p>
          {TEST_KIT_URL && (
            <a
              href={TEST_KIT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
            >
              Order a test kit
            </a>
          )}
          {isPremium && isActive && PREMIUM_TEST_KIT_CODE && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs text-ink/50">Use this code at checkout for your member price:</p>
              <CopyCode code={PREMIUM_TEST_KIT_CODE} />
            </div>
          )}
        </Card>

        {customer.payments.length > 0 && (
          <Card title="Payments">
            <ul className="divide-y divide-line text-sm">
              {customer.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <div className="font-medium text-ink">{usd(p.amount)}</div>
                    <div className="text-xs text-ink/50">
                      Covers {date(p.periodStart)} – {date(p.periodEnd)}
                    </div>
                  </div>
                  <div className="text-xs text-ink/50">{date(p.createdAt)}</div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <p className="pt-2 text-center text-xs text-ink/45">
          Questions? Email{" "}
          <a href={`mailto:${OPS_EMAIL}`} className="font-medium text-primary hover:underline">
            {OPS_EMAIL}
          </a>
        </p>
      </main>
    </div>
  );
}
