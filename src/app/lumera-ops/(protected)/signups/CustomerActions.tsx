"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatPoints } from "@/lib/wallet/rules";
import { createPortal } from "react-dom";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import StatusPill from "@/components/StatusPill";

export interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  planName: string;
  monthlyPrice: number;
  discountPercent: number;
  wantsTestKit: boolean;
  testKitPrice: number;
  status: string;
  referrer: string | null;
  signedUp: string;
  currentPeriodEnd: string | null;
  memberDiscountCode: string | null;
  memberDiscountActive: boolean;
  consultationsUsed: number;
  consultationsIncluded: number;
  complimentary: boolean;
  complimentaryNote: string | null;
  complimentaryBy: string | null;
  payments: { id: string; amount: number; paidOn: string; coversThrough: string; note: string | null }[];
}

const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const inputClass =
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export default function CustomerActions({ customer }: { customer: CustomerRow }) {
  const [modal, setModal] = useState<null | "manage" | "cancel">(null);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setModal("manage")}
        className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-ink/70 transition hover:bg-page-bg"
      >
        Manage
      </button>
      {modal === "manage" && (
        <ManageModal
          customer={customer}
          onClose={() => setModal(null)}
          onCancelMembership={() => setModal("cancel")}
        />
      )}
      {modal === "cancel" && (
        <CancelModal
          customer={customer}
          onBack={() => setModal("manage")}
          onDone={() => setModal(null)}
        />
      )}
    </div>
  );
}

function Backdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      {children}
    </div>,
    document.body,
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-ink/50">{label}</div>
      <div className="font-medium text-ink">{children}</div>
    </div>
  );
}

function ManageModal({
  customer: c,
  onClose,
  onCancelMembership,
}: {
  customer: CustomerRow;
  onClose: () => void;
  onCancelMembership: () => void;
}) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [granting, setGranting] = useState(false);
  const [grantNote, setGrantNote] = useState("");
  const [amount, setAmount] = useState(String(c.monthlyPrice));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"payment" | "consult" | "grant" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const cancelled = c.status === "cancelled";

  async function recordPayment() {
    setBusy("payment");
    setError(null);
    setNotice(null);
    setWarnings([]);
    try {
      const res = await fetch(`/api/lumera-ops/customers/${c.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not record the payment.");
        return;
      }
      setWarnings(data.warnings ?? []);
      setNotice(cancelled ? "Payment recorded. The membership is active again." : "Payment recorded.");
      setPaying(false);
      setNote("");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function grantAccess() {
    setBusy("grant");
    setError(null);
    setNotice(null);
    setWarnings([]);
    try {
      const res = await fetch(`/api/lumera-ops/customers/${c.id}/complimentary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: grantNote }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not grant access.");
        return;
      }
      setWarnings(data.warnings ?? []);
      setNotice("Complimentary access granted. The membership is active with no payment.");
      setGranting(false);
      setGrantNote("");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function adjustConsult(delta: 1 | -1) {
    setBusy("consult");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/lumera-ops/customers/${c.id}/consultations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not update consultations.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-line bg-page-bg/50 p-6">
          <div className="flex items-center gap-3">
            <Avatar name={c.name} />
            <div>
              <h2 className="font-heading text-lg font-bold text-ink">{c.name}</h2>
              <p className="text-xs text-ink/50">{c.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-xl leading-none text-ink/40 transition hover:text-ink">
            &times;
          </button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <Detail label="Plan">
              {c.planName} · {usd(c.monthlyPrice)}/mo
            </Detail>
            <Detail label="Status">
              <StatusPill status={c.status} />
            </Detail>
            {c.complimentary && (
              <Detail label="Billing">
                Complimentary
                <span className="block text-xs font-normal text-ink/50">
                  {c.complimentaryNote}
                  {c.complimentaryBy ? ` · by ${c.complimentaryBy}` : ""}
                </span>
              </Detail>
            )}
            <Detail label={c.status === "active" ? "Active through" : "Period ended"}>
              {c.complimentary ? "No end date" : (c.currentPeriodEnd ?? "—")}
            </Detail>
            <Detail label="Phone">{c.phone || "—"}</Detail>
            <Detail label="Referred by">{c.referrer || "—"}</Detail>
            <Detail label="Signed up">{c.signedUp}</Detail>
            <Detail label="Test kit">{c.wantsTestKit ? `Wants the ${usd(c.testKitPrice)} kit` : "—"}</Detail>
            <Detail label="Member discount">
              {c.memberDiscountCode ? (
                <span>
                  <span className="font-mono text-xs">{c.memberDiscountCode}</span>{" "}
                  <span className={c.memberDiscountActive ? "text-emerald-700" : "text-ink/40"}>
                    {c.memberDiscountActive ? `(${c.discountPercent}% off, live)` : "(off)"}
                  </span>
                </span>
              ) : (
                "—"
              )}
            </Detail>
          </div>

          {c.consultationsIncluded > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-line p-4">
              <div>
                <div className="font-heading text-sm font-semibold text-ink">Consultations</div>
                <div className="text-xs text-ink/50">
                  {c.consultationsUsed} of {c.consultationsIncluded} used
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => adjustConsult(-1)}
                  disabled={busy !== null || c.consultationsUsed <= 0}
                  aria-label="Undo one consultation"
                  className="h-8 w-8 rounded-lg border border-line text-ink/70 transition hover:bg-page-bg disabled:opacity-40"
                >
                  −
                </button>
                <button
                  onClick={() => adjustConsult(1)}
                  disabled={busy !== null || c.consultationsUsed >= c.consultationsIncluded}
                  aria-label="Log one consultation used"
                  className="h-8 w-8 rounded-lg border border-line text-ink/70 transition hover:bg-page-bg disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          )}

          <WalletSection email={c.email} />

          {!c.complimentary && (
            <div className="rounded-xl border border-dashed border-line p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-heading text-sm font-semibold text-ink">Skip payment</h3>
                  <p className="text-xs text-ink/50">
                    Onboard someone you know without billing. They get full access with no end date.
                  </p>
                </div>
                {!granting && (
                  <button
                    onClick={() => setGranting(true)}
                    className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-page-bg"
                  >
                    Grant free access
                  </button>
                )}
              </div>
              {granting && (
                <div className="mt-3 space-y-3 rounded-lg bg-page-bg/60 p-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink/50">Who is this and why? (required)</label>
                    <input
                      className={inputClass}
                      maxLength={500}
                      placeholder="e.g. Friend of the founder, onboarding for free"
                      value={grantNote}
                      onChange={(e) => setGrantNote(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-ink/50">
                    Turns on the member discount and emails them. No payment is recorded, so no commission or
                    points are earned. Cancelling or recording a real payment ends it.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setGranting(false)}
                      disabled={busy !== null}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-white disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={grantAccess}
                      disabled={busy !== null || !grantNote.trim()}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
                    >
                      {busy === "grant" ? "Granting…" : "Grant access"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-line p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-heading text-sm font-semibold text-ink">Payments</h3>
              {!paying && (
                <button
                  onClick={() => setPaying(true)}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-dark"
                >
                  {cancelled ? "Reactivate with payment" : "Record payment"}
                </button>
              )}
            </div>

            {paying && (
              <div className="mb-3 space-y-3 rounded-lg bg-page-bg/60 p-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink/50">Amount received ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className={inputClass}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink/50">
                    Note <span className="font-normal text-ink/40">(optional)</span>
                  </label>
                  <input
                    className={inputClass}
                    maxLength={500}
                    placeholder="e.g. paid by invoice #1042"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
                <p className="text-xs text-ink/50">
                  Starts or extends the membership by one month, turns on the member discount and
                  emails the customer.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setPaying(false)}
                    disabled={busy !== null}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-white disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={recordPayment}
                    disabled={busy !== null}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
                  >
                    {busy === "payment" ? "Saving…" : "Save payment"}
                  </button>
                </div>
              </div>
            )}

            {c.payments.length === 0 ? (
              <p className="text-xs text-ink/50">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {c.payments.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 py-2">
                    <div>
                      <div className="font-medium text-ink">{usd(p.amount)}</div>
                      <div className="text-xs text-ink/50">Covers through {p.coversThrough}</div>
                      {p.note && <div className="text-xs text-ink/40">{p.note}</div>}
                    </div>
                    <div className="text-xs text-ink/50">{p.paidOn}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}
          {warnings.map((w) => (
            <p key={w} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {w}
            </p>
          ))}
          {error && <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-page-bg/30 p-4">
          {!cancelled ? (
            <button
              onClick={onCancelMembership}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-error transition hover:bg-error/5"
            >
              Cancel membership
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink/70 transition hover:bg-page-bg"
          >
            Close
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

function CancelModal({
  customer: c,
  onBack,
  onDone,
}: {
  customer: CustomerRow;
  onBack: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError(data.warnings.join(" "));
        router.refresh();
        return;
      }
      router.refresh();
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Backdrop onClose={() => !busy && onBack()}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error">
            <Icon name="clipboard" className="h-6 w-6" />
          </div>
          <h3 className="mb-2 text-center font-heading text-lg font-bold text-ink">Cancel this membership?</h3>
          <p className="mb-6 text-center text-sm font-medium text-ink/70">
            <strong className="text-ink">{c.name}</strong>&apos;s {c.planName} membership ends now and their
            member discount code stops working. They keep their payment history, and you can reactivate
            them later by recording a payment.
          </p>
          {error && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={onBack}
              disabled={busy}
              className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-ink/70 transition hover:bg-page-bg disabled:opacity-50"
            >
              Keep membership
            </button>
            <button
              onClick={submitCancel}
              disabled={busy}
              className="flex-1 rounded-xl bg-error py-2.5 text-sm font-medium text-white transition hover:bg-error/90 disabled:opacity-50"
            >
              {busy ? "Cancelling…" : "Cancel it"}
            </button>
          </div>
        </div>
      </div>
    </Backdrop>
  );
}

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
function WalletSection({ email }: { email: string }) {
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
