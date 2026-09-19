import Link from "next/link";
import { redirect } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
import { getAffiliateSession } from "@/lib/affiliates/session";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getAffiliateSession();
  if (session) redirect(`/affiliates/dashboard/${session.affiliateId}`);

  const { error } = await searchParams;

  return (
    <AuthLayout
      headline="Welcome back to your dashboard"
      blurb="See what your referrals have earned, share your link, and request your next payout."
      title="Affiliate login"
      subtitle="Enter your email and we'll send you a one-time link. No password needed."
    >
      <LoginForm initialError={typeof error === "string" ? error : undefined} />

      <p className="mt-6 text-center text-sm text-ink/50">
        Not an affiliate yet?{" "}
        <Link href="/affiliates/apply" className="font-medium text-primary hover:underline">
          Apply now
        </Link>
      </p>
    </AuthLayout>
  );
}
