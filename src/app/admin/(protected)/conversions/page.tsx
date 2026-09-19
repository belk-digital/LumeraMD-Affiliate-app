import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import ConversionRow from "./ConversionRow";

export default async function AdminConversionsPage() {
  await requireAdminPage();
  const conversions = await prisma.affiliateConversion.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { affiliate: true },
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">
          Conversions
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          Most recent {conversions.length} orders
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-5 shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-page-bg text-left text-xs font-medium text-ink/60">
              <th className="py-3 px-4 font-medium">Order</th>
              <th className="py-3 px-4 font-medium">Affiliate</th>
              <th className="py-3 px-4 font-medium">Source</th>
              <th className="py-3 px-4 font-medium">Commission</th>
              <th className="py-3 px-4 font-medium">Status</th>
              <th className="py-3 px-4 font-medium">Date</th>
              <th className="py-3 px-4 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {conversions.map((c) => (
              <ConversionRow key={c.id} conversion={c} />
            ))}
            {conversions.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-ink/40">
                  No conversions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
