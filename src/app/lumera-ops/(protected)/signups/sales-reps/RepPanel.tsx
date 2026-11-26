"use client";

import Link from "next/link";
import {
  Briefcase,
  Calendar,
  Check,
  Copy,
  CreditCard,
  DollarSign,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Tag,
  User,
  Users,
  X,
} from "lucide-react";
import { initials } from "@/components/Avatar";
import StatusPill from "@/components/StatusPill";
import { DetailPanel, InfoRow, Notice, useCopy } from "../_components/kit";
import { usd } from "../_components/fmt";
import type { RepData } from "./types";

export const REP_TABS = [
  { key: "overview", label: "Overview" },
  { key: "documents", label: "Documents" },
  { key: "notes", label: "Notes" },
];

export default function RepPanel({
  rep,
  tab,
  onTab,
  onClose,
  onApprove,
  onReject,
  busy,
  error,
}: {
  rep: RepData;
  tab: string;
  onTab: (key: string) => void;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
  error: string | null;
}) {
  const actionable = !rep.linkedAffiliateId;
  const link = useCopy();
  const profileHref = `/lumera-ops/sales-reps/${rep.id}`;
  const moreInfo = `mailto:${rep.email}?subject=${encodeURIComponent("Your LumeraMD application")}&body=${encodeURIComponent(
    `Hi ${rep.name.split(" ")[0]},\n\nThanks for applying to the LumeraMD sales rep program. Before we can finish reviewing your application, could you tell us a little more about:\n\n- \n\nThanks!`,
  )}`;

  return (
    <DetailPanel
      title="Applicant details"
      onClose={onClose}
      tabs={REP_TABS}
      tab={tab}
      onTab={onTab}
      header={
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-semibold text-primary">
            {initials(rep.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-heading text-base font-bold text-ink">{rep.name}</div>
            <div className="truncate text-xs text-ink/55">{rep.email}</div>
          </div>
          <StatusPill status={rep.status} />
        </div>
      }
      footer={
        <>
          {error && <Notice tone="bad">{error}</Notice>}
          {actionable ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onApprove}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {busy ? "Working…" : rep.status === "rejected" ? "Approve instead" : "Approve"}
                </button>
                {rep.status === "pending" ? (
                  <button
                    onClick={onReject}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-xl bg-error px-4 py-2.5 text-sm font-medium text-white transition hover:bg-error/90 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                ) : (
                  <span />
                )}
              </div>
              <a
                href={moreInfo}
                className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-page-bg"
              >
                <MessageSquare className="h-4 w-4" />
                Request more information
              </a>
              <Link
                href={profileHref}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark"
              >
                View full profile
              </Link>
            </>
          ) : (
            <>
              <Link
                href={profileHref}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark"
              >
                View full profile
              </Link>
              <Link
                href={`/lumera-ops/affiliates/${rep.linkedAffiliateId}`}
                className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-page-bg"
              >
                View affiliate account
              </Link>
            </>
          )}
        </>
      }
    >
      {tab === "overview" && (
        <>
          <div className="divide-y divide-line/60">
            <InfoRow icon={<User className="h-4 w-4" />} label="Full name">
              {rep.name}
            </InfoRow>
            <InfoRow icon={<Mail className="h-4 w-4" />} label="Email">
              <a href={`mailto:${rep.email}`} className="text-primary hover:underline">
                {rep.email}
              </a>
            </InfoRow>
            <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone">
              {rep.phone || "—"}
            </InfoRow>
            <InfoRow icon={<CreditCard className="h-4 w-4" />} label="Plan">
              {rep.plan || "—"}
            </InfoRow>
            <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Type of sales">
              {rep.salesType ? (
                <span className="inline-block rounded-md bg-page-bg px-2 py-0.5 text-xs font-medium text-ink/70">{rep.salesType}</span>
              ) : (
                "—"
              )}
            </InfoRow>
            <InfoRow icon={<DollarSign className="h-4 w-4" />} label="Annual gross sales">
              {rep.annualGrossSales != null ? usd(rep.annualGrossSales) : "—"}
            </InfoRow>
            <InfoRow icon={<Users className="h-4 w-4" />} label="Referred by">
              {rep.referrer || "—"}
            </InfoRow>
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Applied on">
              {rep.appliedOn}
            </InfoRow>
          </div>

          {actionable && (
            <p className="rounded-lg bg-primary-light px-3 py-2 text-xs text-primary">
              Approving creates their affiliate account, referral link and discount code, places them under whoever
              referred them, and emails them a welcome message and a link to pay for their Premium membership.
            </p>
          )}

          {rep.linkedAffiliateId && rep.membership && (
            <div className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-heading text-sm font-semibold text-ink">Premium membership</h3>
                  <p className="text-xs text-ink/50">The monthly fee a rep pays to unlock benefits and overrides.</p>
                </div>
                <StatusPill status={rep.membership.status} />
              </div>
              {rep.membership.payLink && (
                <button
                  onClick={() => link.copy(rep.membership!.payLink!)}
                  className="mt-3 flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-page-bg"
                >
                  {link.copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {link.copied ? "Copied" : "Copy payment link"}
                </button>
              )}
              <p className="mt-2 text-xs text-ink/45">Record or review their payments under the Customers tab.</p>
            </div>
          )}
        </>
      )}

      {tab === "documents" && (
        <div className="rounded-xl border border-line p-4">
          <h3 className="mb-2 flex items-center gap-2 font-heading text-sm font-semibold text-ink">
            <FileText className="h-4 w-4 text-ink/40" />
            Resume
          </h3>
          {rep.hasResume ? (
            <a
              href={`/api/lumera-ops/sales-reps/${rep.id}/resume`}
              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              {rep.resumeFileName ? `Download ${rep.resumeFileName}` : "Download resume"} &rarr;
            </a>
          ) : (
            <p className="text-xs text-ink/50">No resume was attached.</p>
          )}
        </div>
      )}

      {tab === "notes" && (
        <div className="rounded-xl border border-line p-4">
          <h3 className="mb-2 flex items-center gap-2 font-heading text-sm font-semibold text-ink">
            <Tag className="h-4 w-4 text-ink/40" />
            Review note
          </h3>
          {rep.reviewNotes ? (
            <p className="whitespace-pre-wrap text-ink/80">{rep.reviewNotes}</p>
          ) : (
            <p className="text-xs text-ink/50">No note yet. You can add one when you reject an application.</p>
          )}
        </div>
      )}
    </DetailPanel>
  );
}
