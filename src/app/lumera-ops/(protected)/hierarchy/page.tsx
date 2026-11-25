import { requireAdminPage } from "@/lib/admin/requireAdmin";
import { getAdminHierarchy } from "@/lib/affiliates/hierarchy";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import HierarchyTree from "@/components/hierarchy/HierarchyTree";

export const dynamic = "force-dynamic";

export default async function AdminHierarchyPage() {
  await requireAdminPage();
  const [{ root, totals }, moves] = await Promise.all([
    getAdminHierarchy(),
    prisma.affiliateMove.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink">Hierarchy</h1>
        <p className="mt-1 text-sm text-slate-500">
          The full recruiting tree. {totals.affiliates} affiliates, {formatMoney(totals.sales)} in lifetime sales. Click
          a card to open that affiliate, or drag one onto another to move them.
        </p>
      </div>
      <HierarchyTree root={root} admin defaultOpenDepth={3} linkBase="/lumera-ops/affiliates" />

      <section className="mt-8">
        <h2 className="text-base font-semibold text-ink">Move history</h2>
        <p className="mt-1 text-sm text-slate-500">Every change made by dragging in the tree. Latest 50.</p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-line bg-page-bg text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Affiliate</th>
                <th className="px-4 py-2.5 font-medium">From</th>
                <th className="px-4 py-2.5 font-medium">To</th>
                <th className="px-4 py-2.5 font-medium">Team moved</th>
                <th className="px-4 py-2.5 font-medium">Pending orders updated</th>
                <th className="px-4 py-2.5 font-medium">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {moves.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    No moves yet.
                  </td>
                </tr>
              )}
              {moves.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                    {m.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-ink">{m.affiliateName}</td>
                  <td className="px-4 py-2.5 text-slate-600">{m.fromParentName ?? "Top level"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{m.toParentName ?? "Top level"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{m.teamSize}</td>
                  <td className="px-4 py-2.5 text-slate-600">{m.pendingOrdersUpdated}</td>
                  <td className="px-4 py-2.5 text-slate-600">{m.movedByEmail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
