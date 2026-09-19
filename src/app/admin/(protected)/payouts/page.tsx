import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import PayoutRow from "./PayoutRow";

export default async function AdminPayoutsPage() {
  await requireAdminPage();
  const payouts = await prisma.affiliatePayout.findMany({
    orderBy: { createdAt: "desc" },
    include: { affiliate: true },
  });

  return (
    <div className="max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">
          Payouts
        </h1>
        <p className="mt-1 text-sm text-ink/60">{payouts.length} total</p>
      </div>

      {payouts.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-ink/40">
          No payout requests yet.
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map((p) => (
            <PayoutRow key={p.id} payout={p} />
          ))}
        </div>
      )}
    </div>
  );
}
