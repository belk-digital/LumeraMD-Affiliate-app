import { requireAdminPage } from "@/lib/admin/requireAdmin";
import { getAdminHierarchy } from "@/lib/affiliates/hierarchy";
import { formatMoney } from "@/lib/format";
import HierarchyTree from "@/components/hierarchy/HierarchyTree";

export const dynamic = "force-dynamic";

export default async function AdminHierarchyPage() {
  await requireAdminPage();
  const { root, totals } = await getAdminHierarchy();

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink">Hierarchy</h1>
        <p className="mt-1 text-sm text-slate-500">
          The full recruiting tree. {totals.affiliates} affiliates, {formatMoney(totals.sales)} in lifetime sales. Click
          a card to open that affiliate.
        </p>
      </div>
      <HierarchyTree root={root} admin defaultOpenDepth={3} linkBase="/lumera-ops/affiliates" />
    </div>
  );
}
