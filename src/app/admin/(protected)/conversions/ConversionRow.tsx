"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AffiliateConversion,
  Affiliate,
} from "@/generated/prisma/client";

const statusStyles: Record<string, string> = {
  pending: "bg-primary-light text-primary-dark",
  approved: "bg-primary/10 text-primary-dark",
  paid: "bg-primary-dark/10 text-primary-dark",
  reversed: "bg-error/10 text-error",
  voided: "bg-ink/10 text-ink/50",
};

export default function ConversionRow({
  conversion,
}: {
  conversion: AffiliateConversion & { affiliate: Affiliate };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reverse() {
    if (!confirm("Reverse this conversion? This cannot be undone.")) return;
    setBusy(true);
    await fetch(`/api/admin/conversions/${conversion.id}/reverse`, {
      method: "POST",
    });
    setBusy(false);
    router.refresh();
  }

  const canReverse = ["pending", "approved"].includes(conversion.status);

  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-3 px-4">{conversion.shopifyOrderName ?? "—"}</td>
      <td className="py-3 px-4">{conversion.affiliate.userEmail}</td>
      <td className="py-3 px-4 capitalize">
        {conversion.attributionSource.replace("_", " ")}
      </td>
      <td className="py-3 px-4">${conversion.commissionAmount.toFixed(2)}</td>
      <td className="py-3 px-4">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[conversion.status] ?? ""}`}
        >
          {conversion.status}
        </span>
      </td>
      <td className="py-3 px-4">
        {conversion.createdAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })}
      </td>
      <td className="py-3 px-4">
        {canReverse && (
          <button
            onClick={reverse}
            disabled={busy}
            className="text-xs text-error hover:underline disabled:opacity-50"
          >
            Reverse
          </button>
        )}
      </td>
    </tr>
  );
}
