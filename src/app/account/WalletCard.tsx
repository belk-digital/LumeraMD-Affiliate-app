"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/Icon";
import { formatPoints, toCents } from "@/lib/wallet/rules";
import { CopyCode } from "./AccountClient";
import { Card } from "./ui";

export interface WalletCardProps {
  enabled: boolean;
  canRedeem: boolean;
  /** Why redeeming isn't available right now, shown instead of the form. */
  redeemBlockedReason: string | null;
  balanceCents: number;
  minRedeemCents: number;
  expiryDays: number;
  earn: { orderPercent: number; orderMin: number; membershipPercent: number };
  codes: { id: string; code: string; amountCents: number; expires: string }[];
}

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

/** Balance, how to earn, and the redeem form with the member's unused codes. History sits below it. */
export default function WalletCard(p: WalletCardProps) {
  const router = useRouter();
  const [points, setPoints] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ code: string; amountCents: number; expires: string } | null>(null);

  const requested = Number(points);
  const requestedCents = Number.isFinite(requested) && requested > 0 ? toCents(requested) : 0;
  const tooSmall = requestedCents > 0 && requestedCents < p.minRedeemCents;
  const tooMuch = requestedCents > p.balanceCents;

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    setBusy(true);
    try {
      const res = await fetch("/api/customers/wallet/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: requested }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create the code.");
        return;
      }
      setCreated({
        code: data.code,
        amountCents: data.amountCents,
        expires: new Date(data.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      });
      setPoints("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
              <Icon name="wallet" className="h-7 w-7" />
            </span>
            <div>
              <div className="font-heading text-4xl font-bold text-ink">
                {formatPoints(p.balanceCents)} <span className="text-lg font-normal text-ink/50">points</span>
              </div>
              <div className="text-sm text-ink/55">Worth ${formatPoints(p.balanceCents)} in store credit</div>
            </div>
          </div>
          {p.enabled && (
            <p className="rounded-xl bg-page-bg px-4 py-3 text-xs leading-relaxed text-ink/65 md:ml-auto md:max-w-md">
              {p.earn.orderPercent > 0 && (
                <>
                  Earn <strong>{p.earn.orderPercent}%</strong> back as points on store orders
                  {p.earn.orderMin > 0 ? ` of $${p.earn.orderMin} or more` : ""}, calculated after discounts.{" "}
                </>
              )}
              {p.earn.membershipPercent > 0 && (
                <>
                  You also earn <strong>{p.earn.membershipPercent}%</strong> of each membership payment.{" "}
                </>
              )}
              Use the same email at checkout so your order is credited to you.
            </p>
          )}
        </div>
      </Card>

      <Card title="Turn points into a discount code" icon="dollar">
        {p.canRedeem ? (
          <form onSubmit={redeem} className="space-y-2">
            <p className="text-sm text-ink/60">
              A one-time code for the same dollar amount at checkout. Valid for {p.expiryDays} days; unused points come back.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                inputMode="decimal"
                placeholder={`At least ${formatPoints(p.minRedeemCents)} points`}
                className={inputClass}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                aria-label="Points to redeem"
              />
              <button
                type="submit"
                disabled={busy || requestedCents === 0 || tooSmall || tooMuch}
                className="shrink-0 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create code"}
              </button>
            </div>
            {(tooMuch || tooSmall) && (
              <p className="text-xs text-ink/50">
                {tooMuch ? "That's more than your balance." : `The smallest amount is ${formatPoints(p.minRedeemCents)} points.`}
              </p>
            )}
          </form>
        ) : (
          p.redeemBlockedReason && <p className="text-sm text-ink/60">{p.redeemBlockedReason}</p>
        )}

        {error && <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}

        {created && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="mb-2 text-sm font-medium text-emerald-800">
              Your ${formatPoints(created.amountCents)} code is ready (valid until {created.expires}):
            </p>
            <CopyCode code={created.code} />
          </div>
        )}

        {p.codes.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-medium text-ink">Your unused codes</h3>
            <ul className="space-y-2.5">
              {p.codes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
                  <CopyCode code={c.code} />
                  <span className="text-xs text-ink/55">
                    ${formatPoints(c.amountCents)} · expires {c.expires}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </>
  );
}
