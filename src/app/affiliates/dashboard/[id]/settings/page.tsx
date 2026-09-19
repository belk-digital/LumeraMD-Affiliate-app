import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DashboardShell from "../DashboardShell";
import SettingsForm from "./SettingsForm";
import { requireAffiliateAccess } from "@/lib/affiliates/access";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAffiliateAccess(id);

  const affiliate = await prisma.affiliate.findUnique({ where: { id } });
  if (!affiliate) notFound();

  const appBaseUrl = process.env.APP_BASE_URL ?? "";
  const referralLink = `${appBaseUrl}/ref/${affiliate.referralSlug}`;

  const destination =
    affiliate.payoutDetails &&
    typeof affiliate.payoutDetails === "object" &&
    "destination" in affiliate.payoutDetails
      ? String((affiliate.payoutDetails as { destination: unknown }).destination ?? "")
      : "";

  return (
    <DashboardShell
      affiliateId={affiliate.id}
      affiliateEmail={affiliate.userEmail}
      displayName={affiliate.displayName}
      referralLink={referralLink}
      discountCode={affiliate.shopifyDiscountCode}
    >
      <div className="px-4 sm:px-6 py-6 space-y-6 max-w-2xl">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">
            Settings
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            Manage your profile, payout details and notifications.
          </p>
        </div>

        <SettingsForm
          email={affiliate.userEmail}
          referralSlug={affiliate.referralSlug}
          discountCode={affiliate.shopifyDiscountCode}
          initial={{
            displayName: affiliate.displayName ?? "",
            payoutMethod: affiliate.payoutMethod ?? "",
            payoutDestination: destination,
            emailNotifications: affiliate.emailNotifications,
          }}
        />
      </div>
    </DashboardShell>
  );
}
