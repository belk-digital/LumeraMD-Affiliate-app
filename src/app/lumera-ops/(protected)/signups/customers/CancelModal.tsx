"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/Icon";
import { Backdrop } from "../_components/kit";
import type { CustomerData } from "./types";

/** Confirms ending a membership. Cancelling also stops the member's monthly card charge. */
export default function CancelModal({
  customer: c,
  onClose,
}: {
  customer: CustomerData;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function submitCancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/lumera-ops/customers/${c.id}/cancel`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not cancel this membership.");
        return;
      }
      if (data.warnings?.length) {
        // The membership is cancelled, but something needs the admin's attention (shown, not hidden).
        setWarning(data.warnings.join(" "));
        router.refresh();
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Backdrop onClose={() => !busy && onClose()}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error">
            <Icon name="clipboard" className="h-6 w-6" />
          </div>
          <h3 className="mb-2 text-center font-heading text-lg font-bold text-ink">Cancel this membership?</h3>
          <p className="mb-6 text-center text-sm font-medium text-ink/70">
            <strong className="text-ink">{c.name}</strong>&apos;s {c.planName} membership ends now and their
            member discount code stops working.
            {c.subscriptionId ? " Their monthly card charge is stopped too." : ""} They keep their payment
            history, and you can reactivate them later by recording a payment.
          </p>
          {warning && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              The membership is cancelled, but: {warning}
            </p>
          )}
          {error && <p className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-ink/70 transition hover:bg-page-bg disabled:opacity-50"
            >
              {warning ? "Close" : "Keep membership"}
            </button>
            {!warning && (
              <button
                onClick={submitCancel}
                disabled={busy}
                className="flex-1 rounded-xl bg-error py-2.5 text-sm font-medium text-white transition hover:bg-error/90 disabled:opacity-50"
              >
                {busy ? "Cancelling…" : "Cancel it"}
              </button>
            )}
          </div>
        </div>
      </div>
    </Backdrop>
  );
}
