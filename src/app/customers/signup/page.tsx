import SignupLayout from "@/components/SignupLayout";
import { getInviter } from "@/lib/signup";
import CustomerForm from "./CustomerForm";

export const metadata = { title: "Join LumeraMD · Membership" };

export default async function CustomerSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const inviter = await getInviter((await searchParams).ref);

  return (
    <SignupLayout
      headline="Better pricing, built into your"
      accent="membership"
      blurb="Choose a monthly plan for member discounts on web pricing. Your monthly fee goes toward your telehealth calls."
      points={[
        { icon: "cart", title: "Save on every order", body: "5%, 10% or 15% off web pricing, depending on your plan." },
        { icon: "wallet", title: "Fees go toward your care", body: "Monthly fees are applied to your telehealth calls." },
        { icon: "dna", title: "DNA testing", body: "Test kits are $699, or $599 with Plus and $499 with Premium." },
      ]}
      title="Choose your membership"
      subtitle="Tell us about you and pick a plan."
    >
      {inviter && (
        <p className="animate-fade-up mb-4 rounded-xl bg-primary-light px-4 py-3 text-sm text-primary">
          {inviter.displayName
            ? `You were invited by ${inviter.displayName}.`
            : "You were invited by a LumeraMD representative."}
        </p>
      )}
      <CustomerForm referralSlug={inviter?.slug} />
    </SignupLayout>
  );
}
