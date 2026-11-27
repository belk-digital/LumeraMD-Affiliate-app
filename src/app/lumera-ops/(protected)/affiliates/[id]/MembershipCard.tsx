"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import StatusPill from "@/components/StatusPill";
import { Notice, useCopy } from "../../signups/_components/kit";

export interface MembershipSummary {
  id: string;
  planName: string;
  status: string;
  complimentary: boolean;
  note: string | null;
  /** ISO date the paid period runs to, null for complimentary or never paid. */
  paidThrough: string | null;
  billing: string;
  /** Where the member can pay, when online payment is set up and they owe a payment. */
  payLink: string | null;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

type Mode = null | "pause" | "complimentary";

/** An affiliate's own membership: switch it off (pause), back on (activate) or make it free. The member is emailed each time. */
export default function MembershipCard({ membership }: { membership: MembershipSummary | null }) {
  const router = useRouter();
  const link = useCopy();
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);

  async function run(action: "pause" | "activate" | "complimentary" | "payment-link") {
    if (!membership) return;
    setBusy(true);
    setError(null);
    setWarnings([]);
    setDone(null);
    try {
      const res = await fetch(`/api/lumera-ops/customers/${membership.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "complimentary" ? { note } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setWarnings(data.warnings ?? []);
      setDone(
        action === "pause"
          ? "Membership paused. They have been emailed."
          : action === "activate"
            ? "Membership is active again. They have been emailed."
            : action === "payment-link"
              ? "Payment link emailed to the member."
              : "Membership is now complimentary. They have been emailed.",
      );
      setMode(null);
      setNote("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <div className="flex items-center gap-3 border-b border-line p-5">
      <div className="rounded-lg bg-primary-light p-2 text-primary">
        <BadgeCheck className="h-5 w-5" />
      </div>
      <div>
        <h2 className="font-heading text-base font-semibold leading-tight text-ink">Membership</h2>
        <p className="text-xs text-ink/50">Pause, switch on or make free. They are emailed each time.</p>
      </div>
    </div>
  );

  if (!membership) {
    return (
      <div className="flex flex-col rounded-2xl border border-line bg-white shadow-sm">
        {header}
        <p className="p-5 text-sm text-ink/60">This affiliate has no membership on record.</p>
      </div>
    );
  }

  const { status, complimentary } = membership;
  const canPause = status === "active" || status === "past_due";
  // A paused membership whose paid period ended needs a payment, not an Activate.
  const canActivate = status === "paused" && !membership.payLink;
  const canComp = !(complimentary && status === "active");

  return (
    <div className="flex flex-col rounded-2xl border border-line bg-white shadow-sm">
      {header}
      <div className="space-y-4 p-5">
        <dl className="text-sm">
          {[
            ["Plan", membership.planName],
            ["Status", <StatusPill key="s" status={status} />],
            ["Billing", complimentary ? "Free (complimentary)" : membership.billing],
            ...(membership.paidThrough && !complimentary ? [["Paid until", fmt(membership.paidThrough)]] : []),
            ...(membership.note ? [["Note", membership.note]] : []),
          ].map(([k, v]) => (
            <div key={String(k)} className="flex items-start justify-between gap-4 border-b border-line/60 py-2.5 last:border-0">
              <dt className="shrink-0 text-ink/50">{k}</dt>
              <dd className="min-w-0 break-words text-right font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        {membership.payLink && (
          <button
            type="button"
            onClick={() => link.copy(membership.payLink!)}
            className="w-full break-all rounded-lg bg-page-bg px-3 py-2 text-left text-xs text-ink/70 transition hover:bg-line/50"
            title="Copy the payment link"
          >
            {link.copied ? "Payment link copied!" : membership.payLink}
          </button>
        )}

        {done && <Notice tone="good">{done}</Notice>}
        {warnings.map((w) => (
          <Notice key={w} tone="warn">
            {w}
          </Notice>
        ))}
        {error && <Notice tone="bad">{error}</Notice>}

        {mode === null && (
          <div className="grid gap-2">
            {membership.payLink && (
              <button
                type="button"
                onClick={() => run("payment-link")}
                disabled={busy}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
              >
                {busy ? "Sending..." : "Send payment link"}
              </button>
            )}
            {canActivate && (
              <button
                type="button"
                onClick={() => run("activate")}
                disabled={busy}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
              >
                {busy ? "Activating..." : "Activate membership"}
              </button>
            )}
            {canPause && (
              <button
                type="button"
                onClick={() => setMode("pause")}
                disabled={busy}
                className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-page-bg disabled:opacity-50"
              >
                Pause membership
              </button>
            )}
            {canComp && (
              <button
                type="button"
                onClick={() => setMode("complimentary")}
                disabled={busy}
                className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-page-bg disabled:opacity-50"
              >
                Make complimentary (free)
              </button>
            )}
          </div>
        )}

        {mode === "pause" && (
          <div className="space-y-3 rounded-xl border border-line p-4">
            <p className="text-sm text-ink/70">
              Their monthly card charge is stopped and their member discount is withdrawn. Nothing is deleted, and you can switch
              it back on any time. They will be emailed.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode(null)}
                disabled={busy}
                className="flex-1 rounded-xl border border-line py-2 text-sm font-medium text-ink/70 transition hover:bg-page-bg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => run("pause")}
                disabled={busy}
                className="flex-1 rounded-xl bg-primary py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
              >
                {busy ? "Pausing..." : "Pause membership"}
              </button>
            </div>
          </div>
        )}

        {mode === "complimentary" && (
          <div className="space-y-3 rounded-xl border border-line p-4">
            <p className="text-sm text-ink/70">
              Their membership becomes free: active with no end date, never charged, and no commission is paid on it.
              {membership.billing.toLowerCase().includes("card") && " Their monthly card charge is stopped."} They will be emailed.
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
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode(null)}
                disabled={busy}
                className="flex-1 rounded-xl border border-line py-2 text-sm font-medium text-ink/70 transition hover:bg-page-bg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => run("complimentary")}
                disabled={busy || !note.trim()}
                className="flex-1 rounded-xl bg-primary py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
              >
                {busy ? "Saving..." : "Make complimentary"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
