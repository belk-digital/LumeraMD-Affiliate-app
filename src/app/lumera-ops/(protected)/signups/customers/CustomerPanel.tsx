"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Calendar,
  Check,
  Copy,
  CreditCard,
  FlaskConical,
  Gift,
  Link2,
  Mail,
  Phone,
  Plus,
  Users,
  User,
  Wallet,
  Clock,
} from "lucide-react";
import { initials } from "@/components/Avatar";
import StatusPill from "@/components/StatusPill";
import { formatPoints } from "@/lib/wallet/rules";
import { DetailPanel, InfoRow, Notice, inputClass, useCopy } from "../_components/kit";
import { usd } from "../_components/fmt";
import WalletSection from "./WalletSection";
import type { CustomerData } from "./types";

export const CUSTOMER_TABS = [
  { key: "overview", label: "Overview" },
  { key: "membership", label: "Membership" },
  { key: "payments", label: "Payments" },
  { key: "points", label: "Points" },
];

export default function CustomerPanel({
  customer: c,
  tab,
  onTab,
  onClose,
  onCancel,
  payIntent,
  onPayIntent,
}: {
  customer: CustomerData;
  tab: string;
  onTab: (key: string) => void;
  onClose: () => void;
  onCancel: () => void;
  /** True when "Record payment" was pressed, so the Payments tab opens with the form showing. */
  payIntent: boolean;
  onPayIntent: () => void;
}) {
  const cancelled = c.status === "cancelled";
  const link = useCopy();

  return (
    <DetailPanel
      title="Member details"
      onClose={onClose}
      tabs={CUSTOMER_TABS}
      tab={tab}
      onTab={onTab}
      header={
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-semibold text-primary">
            {initials(c.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-heading text-base font-bold text-ink">{c.name}</div>
            <div className="truncate text-xs text-ink/55">{c.email}</div>
          </div>
          <StatusPill status={c.status} />
        </div>
      }
      footer={
        <>
          <button
            onClick={onPayIntent}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            {cancelled ? "Reactivate with payment" : "Record payment"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            {c.payLink ? (
              <button
                onClick={() => link.copy(c.payLink!)}
                className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-page-bg"
              >
                {link.copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                {link.copied ? "Copied" : "Copy payment link"}
              </button>
            ) : (
              <span />
            )}
            {!cancelled && (
              <button
                onClick={onCancel}
                className="rounded-xl border border-error/30 bg-error/5 px-3 py-2.5 text-sm font-medium text-error transition hover:bg-error/10"
              >
                Cancel membership
              </button>
            )}
          </div>
        </>
      }
    >
      {tab === "overview" && <OverviewTab c={c} />}
      {tab === "membership" && <MembershipTab c={c} />}
      {tab === "payments" && <PaymentsTab key={payIntent ? "open" : "closed"} c={c} startPaying={payIntent} />}
      {tab === "points" && <WalletSection email={c.email} />}
    </DetailPanel>
  );
}

function OverviewTab({ c }: { c: CustomerData }) {
  const billing = c.complimentary
    ? "Complimentary, no payment needed"
    : c.subscriptionId
      ? `Charged monthly by card (subscription ${c.subscriptionId})`
      : "No automatic billing; payments are recorded by hand";
  return (
    <div className="divide-y divide-line/60">
      <InfoRow icon={<User className="h-4 w-4" />} label="Full name">
        {c.name}
      </InfoRow>
      <InfoRow icon={<Mail className="h-4 w-4" />} label="Email">
        <a href={`mailto:${c.email}`} className="text-primary hover:underline">
          {c.email}
        </a>
      </InfoRow>
      <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone">
        {c.phone || "—"}
      </InfoRow>
      <InfoRow icon={<CreditCard className="h-4 w-4" />} label="Plan">
        {c.planLabel} · {usd(c.monthlyPrice)}/mo
      </InfoRow>
      <InfoRow icon={<Calendar className="h-4 w-4" />} label={c.status === "active" ? "Active through" : "Period ended"}>
        {c.complimentary ? "No end date" : (c.currentPeriodEnd ?? "—")}
      </InfoRow>
      <InfoRow icon={<Link2 className="h-4 w-4" />} label="Billing">
        {billing}
      </InfoRow>
      <InfoRow icon={<Gift className="h-4 w-4" />} label="Member discount">
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
      </InfoRow>
      <InfoRow icon={<Wallet className="h-4 w-4" />} label="Wallet points">
        {formatPoints(c.pointsCents)}
      </InfoRow>
      <InfoRow icon={<FlaskConical className="h-4 w-4" />} label="Test kit">
        {c.wantsTestKit ? `Wants the ${usd(c.testKitPrice)} kit` : "—"}
      </InfoRow>
      <InfoRow icon={<Users className="h-4 w-4" />} label="Referred by">
        {c.referrer || "—"}
      </InfoRow>
      <InfoRow icon={<Clock className="h-4 w-4" />} label="Signed up">
        {c.signedUp}
      </InfoRow>
    </div>
  );
}

function MembershipTab({ c }: { c: CustomerData }) {
  const link = useCopy();
  return (
    <>
      <div className="rounded-xl border border-line p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-heading text-base font-semibold text-ink">{c.planLabel}</h3>
          <span className="font-semibold text-ink">{usd(c.monthlyPrice)}/mo</span>
        </div>
        {c.complimentary && (
          <p className="mt-1 text-xs text-ink/55">
            Complimentary{c.complimentaryNote ? `: ${c.complimentaryNote}` : ""}
            {c.complimentaryBy ? ` · by ${c.complimentaryBy}` : ""}
          </p>
        )}
        {c.benefits.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-ink/75">
            {c.benefits.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={3} />
                {b}
              </li>
            ))}
          </ul>
        )}
      </div>

      {c.payLink && (
        <div className="rounded-xl border border-line p-4">
          <h3 className="font-heading text-sm font-semibold text-ink">Payment link</h3>
          <p className="mb-2 text-xs text-ink/50">Send this to the customer so they can pay online with a card.</p>
          <div className="flex gap-2">
            <input readOnly value={c.payLink} onFocus={(e) => e.target.select()} className={`${inputClass} font-mono text-xs`} />
            <button
              onClick={() => link.copy(c.payLink!)}
              className="shrink-0 rounded-lg border border-line px-3 text-xs font-medium text-ink/70 transition hover:bg-page-bg"
            >
              {link.copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {c.consultationsIncluded > 0 && <ConsultationsBlock c={c} />}
      {!c.complimentary && <GrantBlock c={c} />}
    </>
  );
}

function ConsultationsBlock({ c }: { c: CustomerData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function adjust(delta: 1 | -1) {
    setBusy(true);
    setError(null);
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
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-heading text-sm font-semibold text-ink">Consultations</div>
          <div className="text-xs text-ink/50">
            {c.consultationsUsed} of {c.consultationsIncluded} used
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => adjust(-1)}
            disabled={busy || c.consultationsUsed <= 0}
            aria-label="Undo one consultation"
            className="h-8 w-8 rounded-lg border border-line text-ink/70 transition hover:bg-page-bg disabled:opacity-40"
          >
            −
          </button>
          <button
            onClick={() => adjust(1)}
            disabled={busy || c.consultationsUsed >= c.consultationsIncluded}
            aria-label="Log one consultation used"
            className="h-8 w-8 rounded-lg border border-line text-ink/70 transition hover:bg-page-bg disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-error">{error}</p>}
    </div>
  );
}

function GrantBlock({ c }: { c: CustomerData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function grant() {
    setBusy(true);
    setError(null);
    setNotice(null);
    setWarnings([]);
    try {
      const res = await fetch(`/api/lumera-ops/customers/${c.id}/complimentary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not grant access.");
        return;
      }
      setWarnings(data.warnings ?? []);
      setNotice("Complimentary access granted. The membership is active with no payment.");
      setOpen(false);
      setNote("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-line p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-sm font-semibold text-ink">Skip payment</h3>
          <p className="text-xs text-ink/50">Onboard someone you know without billing. They get full access with no end date.</p>
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-page-bg"
          >
            Grant free access
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-3 rounded-lg bg-page-bg/60 p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink/50">Who is this and why? (required)</label>
            <input
              className={inputClass}
              maxLength={500}
              placeholder="e.g. Friend of the founder, onboarding for free"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <p className="text-xs text-ink/50">
            Turns on the member discount and emails them. No payment is recorded, so no commission or points are earned.
            Cancelling or recording a real payment ends it.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              disabled={busy}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={grant}
              disabled={busy || !note.trim()}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
            >
              {busy ? "Granting…" : "Grant access"}
            </button>
          </div>
        </div>
      )}
      <div className="mt-2 space-y-2">
        {notice && <Notice tone="good">{notice}</Notice>}
        {warnings.map((w) => (
          <Notice key={w} tone="warn">
            {w}
          </Notice>
        ))}
        {error && <Notice tone="bad">{error}</Notice>}
      </div>
    </div>
  );
}

function PaymentsTab({ c, startPaying }: { c: CustomerData; startPaying: boolean }) {
  const router = useRouter();
  const cancelled = c.status === "cancelled";
  const [paying, setPaying] = useState(startPaying);
  const [amount, setAmount] = useState(String(c.monthlyPrice));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function recordPayment() {
    setBusy(true);
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
      setBusy(false);
    }
  }

  return (
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
            <input type="number" step="0.01" min={0} className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
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
            Starts or extends the membership by one month, turns on the member discount and emails the customer.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPaying(false)}
              disabled={busy}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={recordPayment}
              disabled={busy}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save payment"}
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
                <div className="font-medium text-ink">{usd(p.amount, 2)}</div>
                <div className="text-xs text-ink/50">Covers through {p.coversThrough}</div>
                <div className="text-xs text-ink/40">
                  {p.source === "authorizenet" ? "Paid by card" : "Recorded by hand"}
                  {p.note ? ` · ${p.note}` : ""}
                </div>
              </div>
              <div className="text-xs text-ink/50">{p.paidOn}</div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 space-y-2">
        {notice && <Notice tone="good">{notice}</Notice>}
        {warnings.map((w) => (
          <Notice key={w} tone="warn">
            {w}
          </Notice>
        ))}
        {error && <Notice tone="bad">{error}</Notice>}
      </div>
    </div>
  );
}
