"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import StatusPill from "@/components/StatusPill";

export interface SalesRepRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  annualGrossSales: number | null;
  salesType: string | null;
  /** e.g. "Agent · $79/mo", or null for signups from before plans were offered. */
  plan: string | null;
  hasResume: boolean;
  referrer: string | null;
  signedUp: string;
  status: string;
  reviewNotes: string | null;
  linkedAffiliateId: string | null;
}

type Action = "approve" | "reject";

const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export default function SalesRepActions({ rep }: { rep: SalesRepRow }) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "review" | "reject">(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  async function act(action: Action, reviewNotes?: string): Promise<boolean> {
    setBusy(action);
    setError(null);
    setMenuOpen(false);
    try {
      const res = await fetch(`/api/lumera-ops/sales-reps/${rep.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNotes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Could not ${action} this signup.`);
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(null);
    }
  }

  const modals = (
    <>
      {modal === "review" && (
        <ReviewModal
          rep={rep}
          busy={busy}
          error={error}
          onClose={() => {
            setModal(null);
            setError(null);
          }}
          onApprove={async () => {
            if (await act("approve")) setModal(null);
          }}
          onReject={() => {
            setError(null);
            setModal("reject");
          }}
        />
      )}
      {modal === "reject" && (
        <RejectModal
          rep={rep}
          busy={busy === "reject"}
          error={error}
          onCancel={() => {
            setModal(null);
            setError(null);
          }}
          onConfirm={async (notes) => {
            if (await act("reject", notes)) setModal(null);
          }}
        />
      )}
    </>
  );

  if (rep.linkedAffiliateId) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setModal("review")}
          className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-ink/70 transition hover:bg-page-bg"
        >
          Review
        </button>
        <Link
          href={`/lumera-ops/affiliates/${rep.linkedAffiliateId}`}
          className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-ink/70 transition hover:bg-page-bg"
        >
          View
        </Link>
        {modals}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setModal("review")}
          className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-ink/70 transition hover:bg-page-bg"
        >
          Review
        </button>
        <button
          onClick={() => act("approve")}
          disabled={busy !== null}
          className="rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
        >
          {busy === "approve" ? "Working…" : rep.status === "rejected" ? "Approve instead" : "Approve"}
        </button>
        {rep.status === "pending" && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="More actions"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink/50 hover:bg-page-bg"
            >
              <Icon name="dots" className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-xl border border-line bg-white p-1 shadow-lg">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setError(null);
                    setModal("reject");
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {error && modal === null && <p className="mt-1.5 max-w-[240px] text-xs text-error">{error}</p>}
      {modals}
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

function ReviewModal({
  rep,
  busy,
  error,
  onClose,
  onApprove,
  onReject,
}: {
  rep: SalesRepRow;
  busy: Action | null;
  error: string | null;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const actionable = !rep.linkedAffiliateId;
  return (
    <Backdrop onClose={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-line bg-page-bg/50 p-6">
          <div className="flex items-center gap-3">
            <Avatar name={rep.name} />
            <div>
              <h2 className="font-heading text-lg font-bold text-ink">{rep.name}</h2>
              <p className="text-xs text-ink/50">{rep.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-xl leading-none text-ink/40 transition hover:text-ink">
            &times;
          </button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <Detail label="Phone">{rep.phone || "—"}</Detail>
            <Detail label="Signed up">{rep.signedUp}</Detail>
            <Detail label="Annual gross sales">
              {rep.annualGrossSales != null ? usd(rep.annualGrossSales) : "—"}
            </Detail>
            <Detail label="Type of sales">{rep.salesType || "—"}</Detail>
            <Detail label="Plan">{rep.plan || "—"}</Detail>
            <Detail label="Referred by">{rep.referrer || "—"}</Detail>
            <Detail label="Status">
              <StatusPill status={rep.status} />
            </Detail>
          </div>

          <div className="rounded-xl border border-line p-4">
            <h3 className="mb-2 font-heading text-sm font-semibold text-ink">Resume</h3>
            {rep.hasResume ? (
              <a
                href={`/api/lumera-ops/sales-reps/${rep.id}/resume`}
                className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
              >
                Download resume &rarr;
              </a>
            ) : (
              <p className="text-xs text-ink/50">No resume was attached.</p>
            )}
          </div>

          {rep.reviewNotes && (
            <div>
              <div className="text-xs font-medium text-ink/50">Review note</div>
              <p className="text-ink/80">{rep.reviewNotes}</p>
            </div>
          )}

          {actionable && (
            <p className="rounded-lg bg-primary-light px-3 py-2 text-xs text-primary">
              Approving creates their affiliate account, referral link and discount code, places them
              under whoever referred them, and emails them a welcome message.
            </p>
          )}

          {error && <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}
        </div>

        {actionable && (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-page-bg/30 p-4">
            {rep.status === "pending" && (
              <button
                onClick={onReject}
                disabled={busy !== null}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-error transition hover:bg-error/5 disabled:opacity-50"
              >
                Reject
              </button>
            )}
            <button
              onClick={onApprove}
              disabled={busy !== null}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
            >
              {busy === "approve" ? "Working…" : rep.status === "rejected" ? "Approve instead" : "Approve"}
            </button>
          </div>
        )}
      </div>
    </Backdrop>
  );
}

function RejectModal({
  rep,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  rep: SalesRepRow;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  return (
    <Backdrop onClose={() => !busy && onCancel()}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error">
            <Icon name="clipboard" className="h-6 w-6" />
          </div>
          <h3 className="mb-2 text-center font-heading text-lg font-bold text-ink">Reject this signup?</h3>
          <p className="mb-4 text-center text-sm font-medium text-ink/70">
            <strong className="text-ink">{rep.name}</strong> won&apos;t get an affiliate account. You can still
            approve them later.
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
              onClick={onCancel}
              disabled={busy}
              className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-ink/70 transition hover:bg-page-bg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(notes.trim())}
              disabled={busy}
              className="flex-1 rounded-xl bg-error py-2.5 text-sm font-medium text-white transition hover:bg-error/90 disabled:opacity-50"
            >
              {busy ? "Rejecting…" : "Reject"}
            </button>
          </div>
        </div>
      </div>
    </Backdrop>
  );
}
