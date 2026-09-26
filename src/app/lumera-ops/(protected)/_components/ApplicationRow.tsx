"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { AffiliateApplication } from "@/generated/prisma/client";
import Avatar from "@/components/Avatar";
import StatusPill from "@/components/StatusPill";
import ApplicationActions from "./ApplicationActions";

// The W-9 file itself lives in Neon Object Storage (see w9StorageKey) — this row type never
// carries the actual file content, just metadata (filename, type, verification state).
export type ApplicationListItem = AffiliateApplication;

const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtDateTime = (d: Date) => new Date(d).toLocaleString();

export default function ApplicationRow({ application: a }: { application: ApplicationListItem }) {
  const [reviewOpen, setReviewOpen] = useState(false);

  return (
    <>
      <tr className="border-b border-line last:border-0">
        <td className="px-2.5 py-3">
          <button
            onClick={() => setReviewOpen(true)}
            className="flex items-center gap-2.5 text-left hover:text-primary transition"
          >
            <Avatar name={a.displayName} />
            <span className="whitespace-nowrap font-medium text-ink">{a.displayName}</span>
          </button>
        </td>
        <td className="whitespace-nowrap px-2.5 py-3 text-ink/70">{a.email}</td>
        <td className="whitespace-nowrap px-2.5 py-3 text-ink/70">{fmtDate(a.createdAt)}</td>
        <td className="px-2.5 py-3">
          <StatusPill status={a.status} />
        </td>
        <td className="px-2.5 py-3">
          <ApplicationActions
            id={a.id}
            status={a.status}
            linkedAffiliateId={a.linkedAffiliateId}
            w9FileName={a.w9FileName}
            w9VerifiedAt={a.w9VerifiedAt}
            onReview={() => setReviewOpen(true)}
          />
        </td>
      </tr>

      {reviewOpen && <ReviewModal application={a} onClose={() => setReviewOpen(false)} />}
    </>
  );
}

function ReviewModal({
  application: a,
  onClose,
}: {
  application: ApplicationListItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const [verifying, setVerifying] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsW9 = !!a.w9FileName;
  const isVerified = !!a.w9VerifiedAt;
  const canApprove = a.status === "pending" && (!needsW9 || isVerified);

  async function handleVerify() {
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch(`/api/lumera-ops/applications/${a.id}/verify-w9`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not verify the W-9.");
        return;
      }
      router.refresh();
    } finally {
      setVerifying(false);
    }
  }

  async function handleApprove() {
    setActing(true);
    setError(null);
    try {
      const res = await fetch(`/api/lumera-ops/applications/${a.id}/approve`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not approve this application.");
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    if (!confirm("Reject this application?")) return;
    setActing(true);
    setError(null);
    try {
      const res = await fetch(`/api/lumera-ops/applications/${a.id}/reject`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not reject this application.");
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setActing(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-line bg-page-bg/50 p-6">
          <div className="flex items-center gap-3">
            <Avatar name={a.displayName} />
            <div>
              <h2 className="font-heading text-lg font-bold text-ink">{a.displayName}</h2>
              <p className="text-xs text-ink/50">{a.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink/40 hover:text-ink transition text-xl leading-none">
            &times;
          </button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-medium text-ink/50">First name</div>
              <div className="font-medium text-ink">{a.firstName || "—"}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-ink/50">Last name</div>
              <div className="font-medium text-ink">{a.lastName || "—"}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-ink/50">Applied</div>
              <div className="font-medium text-ink">{fmtDate(a.createdAt)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-ink/50">Status</div>
              <StatusPill status={a.status} />
            </div>
          </div>

          {a.websiteUrl && (
            <div>
              <div className="text-xs font-medium text-ink/50">Website / social</div>
              <a
                href={a.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline break-all"
              >
                {a.websiteUrl}
              </a>
            </div>
          )}

          {a.promotionMethods && (
            <div>
              <div className="text-xs font-medium text-ink/50">How they&apos;ll promote us</div>
              <p className="text-ink/80">{a.promotionMethods}</p>
            </div>
          )}

          <div className="rounded-xl border border-line p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-heading text-sm font-semibold text-ink">W-9 tax form</h3>
              {isVerified ? (
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  Verified
                </span>
              ) : needsW9 ? (
                <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                  Not verified
                </span>
              ) : (
                <span className="rounded-full bg-line px-2.5 py-0.5 text-xs font-medium text-ink/50">
                  None submitted
                </span>
              )}
            </div>

            {needsW9 ? (
              <>
                <a
                  href={`/api/lumera-ops/applications/${a.id}/w9`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary font-medium hover:underline"
                >
                  View {a.w9FileName || "W-9 file"} &rarr;
                </a>
                {isVerified ? (
                  <p className="mt-2 text-xs text-ink/50">
                    Verified by {a.w9VerifiedBy} on {a.w9VerifiedAt ? fmtDateTime(a.w9VerifiedAt) : ""}
                  </p>
                ) : (
                  <div className="mt-3">
                    <button
                      onClick={handleVerify}
                      disabled={verifying}
                      className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-ink/80 transition hover:bg-page-bg disabled:opacity-50"
                    >
                      {verifying ? "Marking..." : "Mark W-9 as verified"}
                    </button>
                    <p className="mt-2 text-xs text-ink/50">
                      Open the file above and confirm it&apos;s a properly signed W-9 before verifying.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-ink/50">
                This application was submitted before the W-9 requirement, or the applicant didn&apos;t attach one.
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>
          )}
        </div>

        {a.status === "pending" && (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-page-bg/30 p-4">
            <button
              onClick={handleReject}
              disabled={acting}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-error transition hover:bg-error/5 disabled:opacity-50"
            >
              Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={acting || !canApprove}
              title={!canApprove ? "Verify the W-9 before approving" : undefined}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
            >
              {acting ? "Working…" : "Approve"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
