import AuthLayout from "@/components/AuthLayout";
import { prisma } from "@/lib/prisma";
import ApplyForm from "./ApplyForm";

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const rawRef = (await searchParams).ref;
  const slug = typeof rawRef === "string" ? rawRef : undefined;

  // Only ever expose the inviter's chosen display name, never their email.
  const inviter = slug
    ? await prisma.affiliate.findUnique({
        where: { referralSlug: slug },
        select: { status: true, displayName: true },
      })
    : null;
  const validInviter = inviter && inviter.status === "approved" ? inviter : null;

  return (
    <AuthLayout
      headline="Earn by sharing what you trust"
      blurb="Apply in a minute. We review every application, then you get your own link, discount code and QR code."
      title="Become an affiliate"
      subtitle="Tell us a little about you. We'll email you as soon as you're approved."
    >
      {validInviter && (
        <p className="animate-fade-up mb-4 rounded-xl bg-primary-light px-4 py-3 text-sm text-primary">
          {validInviter.displayName
            ? `You were invited by ${validInviter.displayName}.`
            : "You were invited by a LumeraMD affiliate."}
        </p>
      )}
      <ApplyForm referralSlug={validInviter ? slug : undefined} />
    </AuthLayout>
  );
}
