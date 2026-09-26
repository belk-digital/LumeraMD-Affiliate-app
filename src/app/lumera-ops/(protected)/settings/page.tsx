import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import SettingsForm from "./SettingsForm";

export default async function AdminSettingsPage() {
  await requireAdminPage();

  const settings = await prisma.affiliateSettings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });

  const emailOverride = process.env.EMAIL_OVERRIDE_TO;
  const admins = (process.env.ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  return (
    <div className="max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Settings</h1>
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
        }}
      />

      <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <h2 className="font-heading text-base font-semibold text-ink">System status</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <dt className="text-ink/50">Email delivery</dt>
            <dd className="text-ink">
              {emailOverride ? (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                  Test mode — all email goes to {emailOverride}
                </span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  Live — email goes to real recipients
                </span>
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <dt className="text-ink/50">Admin access</dt>
            <dd className="text-ink">{admins.join(", ") || "—"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
