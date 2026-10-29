import { redirect } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
import { getAffiliateSession, getInactiveAffiliate } from "@/lib/affiliates/session";
import SignOutButton from "./SignOutButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account suspended · LumeraMD" };

const OPS_EMAIL = process.env.AFFILIATE_OPS_EMAIL ?? "info@lumeramd.com";

// Where a signed-in affiliate lands once their account stops being approved (for example after
// missing the activity requirement). They can't use the dashboard until an admin reactivates them.
export default async function SuspendedPage() {
  const inactive = await getInactiveAffiliate();
  if (!inactive) {
    // Nothing is wrong with their account any more (or they were never signed in).
    const session = await getAffiliateSession();
    redirect(session ? `/affiliates/dashboard/${session.affiliateId}` : "/login");
  }

  const activityReason = inactive.suspendReason?.startsWith("Inactive") ?? false;

  return (
    <AuthLayout
      headline="Your account is paused"
      blurb="We'll help you get back to earning as soon as we can."
      title="Account suspended"
      subtitle={
        inactive.status === "suspended"
          ? "Your affiliate account is currently suspended."
          : "Your affiliate account is not active."
      }
    >
      <div className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-sm">
        <p className="text-sm text-ink/70">
          {activityReason
            ? "Your account was suspended because you didn't meet the activity requirement for your last cycle."
            : "Your dashboard, referral link and payouts are unavailable while your account is suspended."}{" "}
          Contact us and we&apos;ll tell you what&apos;s needed to reactivate it and start a new cycle.
        </p>
        <a
          href={`mailto:${OPS_EMAIL}?subject=${encodeURIComponent("Reactivate my LumeraMD affiliate account")}`}
          className="block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-primary-dark"
        >
          Contact {OPS_EMAIL}
        </a>
        <SignOutButton />
      </div>
    </AuthLayout>
  );
}
