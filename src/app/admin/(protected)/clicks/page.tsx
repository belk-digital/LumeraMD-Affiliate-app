import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/requireAdmin";

export default async function AdminClicksPage() {
  await requireAdminPage();
  const clicks = await prisma.affiliateClick.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { affiliate: true },
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">
          Clicks
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          Most recent {clicks.length} referral clicks
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-5 shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-page-bg text-left text-xs font-medium text-ink/60">
              <th className="py-3 px-4 font-medium">Affiliate</th>
              <th className="py-3 px-4 font-medium">Device</th>
              <th className="py-3 px-4 font-medium">Converted</th>
              <th className="py-3 px-4 font-medium">Suspicious</th>
              <th className="py-3 px-4 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {clicks.map((click) => (
              <tr key={click.id} className="border-b border-line last:border-0">
                <td className="py-3 px-4">{click.affiliate.userEmail}</td>
                <td className="py-3 px-4 capitalize">
                  {click.deviceType ?? "—"}
                </td>
                <td className="py-3 px-4">
                  {click.convertedToOrder ? "Yes" : "No"}
                </td>
                <td className="py-3 px-4">
                  {click.isSuspicious ? (
                    <span className="text-error">Yes</span>
                  ) : (
                    "No"
                  )}
                </td>
                <td className="py-3 px-4">
                  {click.createdAt.toLocaleString()}
                </td>
              </tr>
            ))}
            {clicks.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-ink/40">
                  No clicks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
