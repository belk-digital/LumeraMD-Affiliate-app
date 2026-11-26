"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, MessageSquare, X } from "lucide-react";
import { Backdrop, Notice } from "../../signups/_components/kit";

/** Approve / reject / ask for more information, for an application that has no affiliate account yet. */
export default function RepProfileActions({
  id,
  name,
  email,
  status,
}: {
  id: string;
  name: string;
  email: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [notes, setNotes] = useState("");

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/lumera-ops/sales-reps/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "reject" ? { reviewNotes: notes.trim() } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setRejecting(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const moreInfo = `mailto:${email}?subject=${encodeURIComponent("Your LumeraMD application")}&body=${encodeURIComponent(
    `Hi ${name.split(" ")[0]},\n\nThanks for applying to the LumeraMD sales rep program. Before we can finish reviewing your application, could you tell us a little more about:\n\n- \n\nThanks!`,
  )}`;

  return (
    <div className="space-y-3">
      {error && !rejecting && <Notice tone="bad">{error}</Notice>}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => act("approve")}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {busy && !rejecting ? "Working..." : status === "rejected" ? "Approve instead" : "Approve"}
        </button>
        {status === "pending" ? (
          <button
            onClick={() => setRejecting(true)}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-xl bg-error px-4 py-2.5 text-sm font-medium text-white transition hover:bg-error/90 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Reject
          </button>
        ) : (
          <span />
        )}
      </div>
      <a
        href={moreInfo}
        className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-page-bg"
      >
        <MessageSquare className="h-4 w-4" />
        Request more information
      </a>

      {rejecting && (
        <Backdrop onClose={() => !busy && setRejecting(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-center font-heading text-lg font-bold text-ink">Reject this application?</h3>
            <p className="mb-4 text-center text-sm font-medium text-ink/70">
              <strong className="text-ink">{name}</strong> won&apos;t get an affiliate account. You can still approve them later.
            </p>
            <label className="mb-1.5 block text-xs font-medium text-ink/50">
              Note <span className="font-normal text-ink/40">(optional, internal only)</span>
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mb-4 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            {error && <p className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setRejecting(false)}
                disabled={busy}
                className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-ink/70 transition hover:bg-page-bg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => act("reject")}
                disabled={busy}
                className="flex-1 rounded-xl bg-error py-2.5 text-sm font-medium text-white transition hover:bg-error/90 disabled:opacity-50"
              >
                {busy ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </Backdrop>
      )}
    </div>
  );
}
