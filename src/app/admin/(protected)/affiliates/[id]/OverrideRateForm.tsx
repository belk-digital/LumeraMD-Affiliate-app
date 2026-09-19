"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OverrideRateForm({
  affiliateId,
  initialRate,
  defaultRate,
}: {
  affiliateId: string;
  /** null = no custom rate, the program default applies. */
  initialRate: number | null;
  defaultRate: number;
}) {
  const router = useRouter();
  const initial = initialRate === null ? "" : String(initialRate);
  const [rate, setRate] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const unchanged = rate.trim() === initial;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);

    const res = await fetch(`/api/admin/affiliates/${affiliateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentOverrideRate: rate.trim() }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus("error");
      setError(data.error ?? "Something went wrong");
      return;
    }
    setStatus("saved");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink/80">Team override (%)</label>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.01"
            min={0}
            max={100}
            placeholder={`Default (${defaultRate})`}
            className="w-40 rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-primary focus:ring-2 focus:ring-primary/15"
            value={rate}
            onChange={(e) => {
              setRate(e.target.value);
              setStatus("idle");
            }}
          />
          <button
            type="submit"
            disabled={status === "saving" || unchanged}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
          >
            {status === "saving" ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-ink/40">
          What this affiliate earns, as a percentage of the order subtotal, whenever someone they
          recruited makes a sale. Leave blank to use the program default ({defaultRate}%). Applies
          to future orders only.
        </p>
      </div>
      {status === "saved" && <p className="text-sm text-emerald-600">Saved.</p>}
      {status === "error" && error && (
        <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>
      )}
    </form>
  );
}
