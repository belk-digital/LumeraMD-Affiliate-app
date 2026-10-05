import { requireCustomer } from "@/lib/customers/requireCustomer";
import { PLANS, TEST_KIT_PRICE, type PlanKey } from "@/lib/membership/plans";
import Icon from "@/components/Icon";
import AccountShell from "../AccountShell";
import { CopyCode } from "../AccountClient";
import { ButtonLink, Card, Page, PageHeader, usd } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "DNA Test Kit · LumeraMD" };

const OPS_EMAIL = process.env.AFFILIATE_OPS_EMAIL ?? "info@lumeramd.com";
const ABOUT = [
  "Advanced DNA health insights",
  "Personalized wellness recommendations",
  "Easy at-home collection",
  "Secure and confidential results",
];

export default async function TestKitPage() {
  const customer = await requireCustomer();
  const plan = PLANS[customer.plan as PlanKey];
  const kitPrice = plan?.testKitPrice ?? TEST_KIT_PRICE;
  const discounted = kitPrice < TEST_KIT_PRICE;
  const kitUrl = process.env.TEST_KIT_URL || null;
  const memberCode =
    customer.status === "active"
      ? (customer.plan === "customer_premium"
          ? process.env.PREMIUM_TEST_KIT_CODE
          : customer.plan === "customer_plus"
            ? process.env.PLUS_TEST_KIT_CODE
            : undefined) || null
      : null;

  return (
    <AccountShell name={`${customer.firstName} ${customer.lastName}`.trim()} email={customer.email}>
      <Page>
        <PageHeader title="DNA Test Kit" subtitle="Order your DNA test kit at your member price." />

        <Card title="Your price" icon="flask">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-heading text-4xl font-bold text-ink">{usd(kitPrice)}</span>
            {discounted && <span className="text-lg text-ink/40 line-through">{usd(TEST_KIT_PRICE)}</span>}
          </div>
          <p className="mt-2 text-sm text-ink/60">
            {discounted
              ? `${plan?.name} members get the test kit for ${usd(kitPrice)} instead of ${usd(TEST_KIT_PRICE)}.`
              : `The test kit is ${usd(TEST_KIT_PRICE)}. Plus and Premium members get a lower price.`}
          </p>

          {memberCode && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-ink">Use this code at checkout:</p>
              <CopyCode code={memberCode} />
            </div>
          )}

          <div className="mt-5">
            {kitUrl ? (
              <ButtonLink href={kitUrl} external>View test kit</ButtonLink>
            ) : (
              <span className="inline-block rounded-lg bg-page-bg px-4 py-2.5 text-sm text-ink/60">Ordering opens soon.</span>
            )}
          </div>
        </Card>

        <Card title="About the test kit" icon="check">
          <ul className="grid gap-2.5 text-sm text-ink/80 sm:grid-cols-2">
            {ABOUT.map((b) => (
              <li key={b} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                  <Icon name="check" className="h-3 w-3" strokeWidth={3} />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </Card>

        <p className="text-center text-xs text-ink/45">
          Questions about the kit? Email <a href={`mailto:${OPS_EMAIL}`} className="text-primary hover:underline">{OPS_EMAIL}</a>
        </p>
      </Page>
    </AccountShell>
  );
}
