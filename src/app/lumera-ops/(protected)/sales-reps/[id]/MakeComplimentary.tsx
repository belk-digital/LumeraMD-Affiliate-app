"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice } from "../../signups/_components/kit";

/** Switches a rep's Premium membership to free (complimentary), stopping any monthly card charge. */
export default function MakeComplimentary({ membershipId, billedByCard }: { membershipId: string; billedByCard: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/lumera-ops/customers/${membershipId}/complimentary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not make this membership complimentary.");
        return;
      }
      const w: string[] = data.warnings ?? [];
      setWarnings(w);
      router.refresh();
      if (w.length === 0) setOpen(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (warnings.length > 0) {
    return (
      <div className="mt-4 space-y-2">
        {warnings.map((w) => (
          <Notice key={w} tone="warn">
            {w}
          </Notice>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-page-bg"
        >
          Make complimentary (free)
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border border-line p-4">
          <p className="text-sm text-ink/70">
            Their Premium membership becomes free: active with no end date, never charged, and no commission is paid on
            it.
            {billedByCard && " Their monthly card charge is stopped."}
          </p>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink/70">Note: who is this and why is it free?</label>
            <textarea
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          {error && <Notice tone="bad">{error}</Notice>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="flex-1 rounded-xl border border-line py-2 text-sm font-medium text-ink/70 transition hover:bg-page-bg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !note.trim()}
              className="flex-1 rounded-xl bg-primary py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
            >
              {busy ? "Saving..." : "Make complimentary"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
