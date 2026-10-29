import Link from "next/link";
import SignupLayout from "@/components/SignupLayout";
import Icon from "@/components/Icon";

export const metadata = { title: "Thank you · LumeraMD Membership" };

// Where Authorize.net sends the member after paying. The membership itself is switched on by the
// payment webhook, which can land a few seconds after this page, so this only says what comes next.
export default function PayThanksPage() {
  return (
    <SignupLayout
      headline="Welcome to"
      accent="LumeraMD"
      blurb="Your payment is being confirmed. You'll get an email as soon as your membership is active."
      points={[
        { icon: "cart", title: "Save on every order", body: "Your member discount code arrives in your confirmation email." },
        { icon: "wallet", title: "Fees go toward your care", body: "Monthly fees are applied to your telehealth calls." },
      ]}
      title="Thank you"
      subtitle="We've received your payment."
    >
      <div className="animate-fade-up py-2">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Icon name="check" className="h-6 w-6" strokeWidth={2.4} />
        </span>
        <p className="max-w-md text-sm text-ink/70">
          Your membership will be active in a moment. Watch your email for the confirmation, then sign in to see your
          plan and benefits.
        </p>
        <div className="mt-5 flex gap-4 text-sm font-medium">
          <Link href="/account/login" className="text-primary hover:underline">
            Sign in to your account
          </Link>
          <Link href="/" className="text-ink/60 hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    </SignupLayout>
  );
}
