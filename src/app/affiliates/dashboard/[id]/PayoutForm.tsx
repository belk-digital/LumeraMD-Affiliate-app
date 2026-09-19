"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PayoutForm({
  available,
  minimumThreshold,
  defaultMethod,
  defaultDestination,
}: {
  available: number;
  minimumThreshold: number;
  defaultMethod?: string;
  defaultDestination?: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(available);
  const [payoutMethod, setPayoutMethod] = useState(defaultMethod ?? "zelle");
  const [destination, setDestination] = useState(defaultDestination ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/affiliates/payout-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        payoutMethod,
        payoutDetails: { destination },
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
  const labelClass = "block text-sm font-medium text-ink/80 mb-1.5";

  if (available < minimumThreshold) {
    return (
      <p className="text-sm text-ink/50">
        You need at least{" "}
        <span className="font-medium text-ink/70">
          ${minimumThreshold.toFixed(2)}
        </span>{" "}
        available to request a payout (currently ${available.toFixed(2)}).
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Amount</label>
          <input
            type="number"
            step="0.01"
            max={available}
            min={minimumThreshold}
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value))}
          />
        </div>
        <div>
          <label className={labelClass}>Method</label>
          <select
            className={inputClass}
            value={payoutMethod}
            onChange={(e) => setPayoutMethod(e.target.value)}
          >
            <option value="zelle">Zelle</option>
            <option value="cashapp">Cash App</option>
            <option value="paypal">PayPal</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>
          Payment destination (email / $cashtag)
        </label>
        <input
          required
          className={inputClass}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
      >
        {submitting ? "Requesting…" : "Request payout"}
      </button>
    </form>
  );
}
