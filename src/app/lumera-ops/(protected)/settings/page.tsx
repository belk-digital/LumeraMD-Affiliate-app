import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import { planFromSettings } from "@/lib/affiliates/unilevel";
import { MONITOR_CC } from "@/lib/email/send";
import SettingsForm from "./SettingsForm";
import SystemStatus from "./SystemStatus";

export default async function AdminSettingsPage() {
  await requireAdminPage();

  const settings = await prisma.affiliateSettings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });

  const admins = (process.env.ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink/60">Program-wide defaults and system status.</p>
      </div>

      <SettingsForm
        initial={{
          defaultCommissionRate: settings.defaultCommissionRate,
          defaultCommissionType: settings.defaultCommissionType,
          defaultCommissionOn: settings.defaultCommissionOn,
          defaultCookieDurationDays: settings.defaultCookieDurationDays,
          defaultPendingPeriodDays: settings.defaultPendingPeriodDays,
          defaultMinimumPayoutThreshold: settings.defaultMinimumPayoutThreshold,
          defaultParentOverrideRate: settings.defaultParentOverrideRate,
          defaultCanRecruit: settings.defaultCanRecruit,
          walletEnabled: settings.walletEnabled,
          walletOrderEarnPercent: settings.walletOrderEarnPercent,
          walletOrderMinSubtotal: settings.walletOrderMinSubtotal,
          walletMembershipEarnPercent: settings.walletMembershipEarnPercent,
          walletMinRedeem: settings.walletMinRedeem,
          walletRedeemExpiryDays: settings.walletRedeemExpiryDays,
          unilevelEnabled: settings.unilevelEnabled,
          membershipCommissionEnabled: settings.membershipCommissionEnabled,
          unilevelMinPersonalSales: settings.unilevelMinPersonalSales,
          unilevelRequiredRecruits: settings.unilevelRequiredRecruits,
          unilevelActiveRecruitMinSales: settings.unilevelActiveRecruitMinSales,
          unilevelSlotRates: settings.unilevelSlotRates,
          unilevelSellerTiers: planFromSettings(settings).sellerTiers,
        }}
      />

      <SystemStatus emailLive={Boolean(process.env.RESEND_API_KEY)} ccAddress={MONITOR_CC} admins={admins} />
    </div>
  );
}
