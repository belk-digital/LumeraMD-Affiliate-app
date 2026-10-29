import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SignupLayout from "@/components/SignupLayout";
import { prisma } from "@/lib/prisma";
import { PLANS, type PlanKey } from "@/lib/membership/plans";
import { authnetConfigured, createHostedPaymentToken, hostedPageUrl } from "@/lib/authnet/client";
import PayRedirect from "./PayRedirect";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pay · LumeraMD Membership" };

const APP_BASE_URL = process.env.APP_BASE_URL ?? "";

// The link a member follows to pay: straight after signing up, from the approval email for sales
// reps, and from reminders. It is safe to share: all it can do is start a payment for that
// membership, and nothing about the member is shown.
export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const cancelled = (await searchParams).cancelled !== undefined;

  const customer = await prisma.customerSignup.findUnique({ where: { id } });
  if (!customer) notFound();
  if (customer.status === "cancelled") redirect("/customers/signup");
  // Already paid up (or free): there is nothing to pay.
  if (customer.status === "active") redirect("/account/login");

  const plan = PLANS[customer.plan as PlanKey];

  let token: string | null = null;
  let problem: string | null = null;
  if (!plan) {
    problem = "We couldn't find that membership plan. Please contact us.";
  } else if (!authnetConfigured()) {
    problem = "Online payment isn't available yet. We'll email you as soon as it is.";
  } else {
    try {
      token = await createHostedPaymentToken({
        customerId: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        amount: plan.monthlyPrice,
        description: `${plan.name} membership`,
        returnUrl: `${APP_BASE_URL}/pay/thanks`,
        cancelUrl: `${APP_BASE_URL}/pay/${customer.id}?cancelled=1`,
      });
    } catch (err) {
      console.error("Could not start a payment", customer.id, err);
      problem = "We couldn't start your payment just now. Please try again in a moment.";
    }
  }

  return (
    <SignupLayout
      headline="Start your"
      accent="membership"
      blurb="Pay securely by card. Your membership starts the moment the payment goes through, and renews monthly."
      points={[
        { icon: "card", title: "Secure payment", body: "Card details are entered on Authorize.net's secure page, never on ours." },
        { icon: "cart", title: "Save on every order", body: "Your member discount switches on as soon as you're active." },
      ]}
      title="Complete your payment"
      subtitle={plan ? `${plan.name} membership, $${plan.monthlyPrice} per month.` : "Membership payment"}
    >
      {problem || !token || !plan ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{problem}</p>
      ) : (
        <div className="max-w-sm">
          {cancelled && (
            <p className="mb-4 rounded-xl bg-primary-light px-4 py-3 text-sm text-primary">
              Your payment wasn&apos;t completed. You can try again whenever you&apos;re ready.
            </p>
          )}
          <dl className="mb-5 space-y-1.5 text-sm text-ink/70">
            <div className="flex justify-between gap-3">
              <dt>Plan</dt>
              <dd className="font-medium text-ink">{plan.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Today</dt>
              <dd className="font-medium text-ink">${plan.monthlyPrice.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Then</dt>
              <dd className="font-medium text-ink">${plan.monthlyPrice.toFixed(2)} / month</dd>
            </div>
          </dl>
          <PayRedirect
            actionUrl={hostedPageUrl()}
            token={token}
            label={`Pay $${plan.monthlyPrice.toFixed(2)}`}
            auto={!cancelled}
          />
          <p className="mt-4 text-xs text-ink/50">
            Questions?{" "}
            <Link href="/" className="text-primary hover:underline">
              Contact us
            </Link>
            .
          </p>
        </div>
      )}
    </SignupLayout>
  );
}
