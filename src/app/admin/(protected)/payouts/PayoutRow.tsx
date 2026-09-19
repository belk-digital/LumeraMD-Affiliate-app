"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AffiliatePayout, Affiliate } from "@/generated/prisma/client";

const statusStyles: Record<string, string> = {
  pending: "bg-primary-light text-primary-dark",
  approved: "bg-primary/10 text-primary-dark",
  paid: "bg-primary-dark/10 text-primary-dark",
  rejected: "bg-error/10 text-error",
};

export default function PayoutRow({
  payout,
}: {
  payout: AffiliatePayout & { affiliate: Affiliate };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "approve" | "reject" | "mark-paid") {
    setBusy(true);
    await fetch(`/api/admin/payouts/${payout.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setBusy(false);
    router.refresh();
  }

  const destination =
    payout.payoutDetails && typeof payout.payoutDetails === "object"
      ? (payout.payoutDetails as { destination?: string }).destination
      : undefined;

  return (
    <div className="rounded-xl border border-line bg-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div className="font-medium text-ink">{payout.affiliate.userEmail}</div>
        <div className="text-sm text-ink/50">
          ${payout.amount.toFixed(2)} via {payout.payoutMethod}
          {destination ? ` · ${destination}` : ""}
        </div>
        <span
          className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[payout.status] ?? ""}`}
        >
          {payout.status}
        </span>
      </div>
      <div className="flex gap-2 shrink-0">
        {payout.status === "pending" && (
          <>
            <button
              onClick={() => act("reject")}
              disabled={busy}
              className="rounded-lg border border-line px-3.5 py-2 text-sm text-ink/60 hover:bg-page-bg disabled:opacity-50"
            >
              Reject
            </button>
            <button
              onClick={() => act("approve")}
              disabled={busy}
              className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              Approve
            </button>
          </>
        )}
        {payout.status === "approved" && (
          <button
            onClick={() => act("mark-paid")}
            disabled={busy}
            className="rounded-lg bg-primary-dark px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Mark Paid
          </button>
        )}
      </div>
    </div>
  );
}
