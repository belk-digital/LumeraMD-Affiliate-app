import AuthLayout from "@/components/AuthLayout";
import { getInviter } from "@/lib/signup";
import SalesRepForm from "./SalesRepForm";

export const metadata = { title: "Become a sales rep · LumeraMD" };

export default async function SalesRepSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const inviter = await getInviter((await searchParams).ref);

  return (
    <AuthLayout
      headline="Build a sales career with LumeraMD"
      blurb="Sell products people trust, grow a team, and earn commission on your sales and your team's."
      points={[
        { icon: "chart", title: "Earn up to 20% commission", body: "Your rate grows with your monthly sales." },
        { icon: "cursor", title: "Build a team", body: "Earn overrides on sales from up to five levels of qualified uplines." },
        { icon: "card", title: "Training included", body: "Education and promotions for every agent." },
      ]}
      title="Become a sales rep"
      subtitle="Only your email is required. Attach your resume and we'll take it from there."
    >
      {inviter && (
        <p className="animate-fade-up mb-4 rounded-xl bg-primary-light px-4 py-3 text-sm text-primary">
          {inviter.displayName
            ? `You were invited by ${inviter.displayName}.`
            : "You were invited by a LumeraMD affiliate."}
        </p>
      )}
      <SalesRepForm referralSlug={inviter?.slug} />
    </AuthLayout>
  );
}
