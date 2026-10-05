import SignupLayout from "@/components/SignupLayout";
import { getInviter } from "@/lib/signup";
import SalesRepForm from "./SalesRepForm";

export const metadata = { title: "Become an affiliate · LumeraMD" };

export default async function SalesRepSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const inviter = await getInviter((await searchParams).ref, { forTeam: true });

  return (
    <SignupLayout
      headline="Build a sales career with"
      accent="LumeraMD"
      blurb="Sell products people trust, grow a team, and earn commission on your sales and your team's."
      points={[
        { icon: "chart", title: "Earn up to 20% commission", body: "Your rate grows with your monthly sales." },
        { icon: "users", title: "Build a team", body: "Earn overrides on sales from up to five levels of qualified uplines." },
        { icon: "cap", title: "Training included", body: "Education and promotions for every agent." },
      ]}
      title="Become an affiliate"
      subtitle="Tell us about yourself and pick your plan. We'll review your application and email you."
    >
      {inviter && (
        <p className="animate-fade-up mb-4 rounded-xl bg-primary-light px-4 py-3 text-sm text-primary">
          {inviter.displayName
            ? `You were invited by ${inviter.displayName}.`
            : "You were invited by a LumeraMD affiliate."}
        </p>
      )}
      <SalesRepForm referralSlug={inviter?.slug} />
    </SignupLayout>
  );
}
