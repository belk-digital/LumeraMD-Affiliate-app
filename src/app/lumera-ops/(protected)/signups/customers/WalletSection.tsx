"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatPoints } from "@/lib/wallet/rules";
import { inputClass } from "../_components/kit";

interface WalletData {
  balanceCents: number;
  pendingCodes: number;
  transactions: {
    id: string;
    createdAt: string;
    type: string;
    reason: string | null;
    amountCents: number;
    balanceAfterCents: number;
    createdBy: string | null;
  }[];
}

/** The member's wallet: live balance, recent ledger, and a manual adjustment (always with a reason). */
export default function WalletSection({ email }: { email: string }) {
  const router = useRouter();
  const [data, setData] = useState<WalletData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Bumping this reloads the wallet (after an adjustment) through the effect below.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetch(`/api/lumera-ops/wallet?email=${encodeURIComponent(email)}`)
      .then((res) => {
        if (!res.ok) throw new Error("load failed");
        return res.json();
      })
      .then((d: WalletData) => {
        if (!active) return;
        setData(d);
        setLoadError(null);
      })
      .catch(() => {
        if (active) setLoadError("Couldn't load the wallet.");
      });
    return () => {
      active = false;
    };
  }, [email, reloadKey]);

  async function adjust() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/lumera-ops/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, points: Number(amount), reason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Could not adjust the wallet.");
        return;
      }
      setNotice("Wallet updated.");
      setAmount("");
      setReason("");
      setReloadKey((k) => k + 1);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold text-ink">Wallet points</h3>
        {data && (
          <span className="text-sm font-semibold text-ink">
            {formatPoints(data.balanceCents)} <span className="font-normal text-ink/50">points</span>
          </span>
        )}
      </div>

      {loadError && <p className="text-xs text-error">{loadError}</p>}
      {!data && !loadError && <p className="text-xs text-ink/50">Loading…</p>}

      {data && (
        <>
          {data.pendingCodes > 0 && (
            <p className="mb-2 text-xs text-ink/50">{data.pendingCodes} unused redemption code(s) outstanding.</p>
          )}
          {data.transactions.length === 0 ? (
            <p className="text-xs text-ink/50">No wallet activity yet.</p>
          ) : (
            <ul className="max-h-40 divide-y divide-line overflow-y-auto">
              {data.transactions.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-ink">{t.reason ?? t.type}</div>
                    <div className="text-[11px] text-ink/45">
                      {new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {t.createdBy ? ` · by ${t.createdBy}` : ""}
                    </div>
                  </div>
                  <div className={`shrink-0 text-xs font-semibold ${t.amountCents >= 0 ? "text-emerald-700" : "text-ink/70"}`}>
                    {t.amountCents >= 0 ? "+" : "−"}
                    {formatPoints(Math.abs(t.amountCents))}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 space-y-2 rounded-lg bg-page-bg/60 p-3">
            <p className="text-xs font-medium text-ink/70">Adjust balance</p>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="+10 or -5"
                aria-label="Points to add or remove"
                className={inputClass}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <input
                maxLength={200}
                placeholder="Reason (required)"
                aria-label="Reason for the adjustment"
                className={inputClass}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-ink/45">Recorded with your email. Can&apos;t go below zero.</span>
              <button
                onClick={adjust}
                disabled={busy || !amount || !reason.trim()}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
              >
                {busy ? "Saving…" : "Apply"}
              </button>
            </div>
            {notice && <p className="text-xs text-emerald-700">{notice}</p>}
            {error && <p className="text-xs text-error">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
