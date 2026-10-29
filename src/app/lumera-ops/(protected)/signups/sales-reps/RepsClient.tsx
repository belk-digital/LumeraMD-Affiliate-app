"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, FileText, XCircle } from "lucide-react";
import Avatar from "@/components/Avatar";
import StatusPill from "@/components/StatusPill";
import type { SignupQuery } from "@/lib/admin/signupFilters";
import {
  EmptyPanel,
  ExportButton,
  FilterSelect,
  Notice,
  Pagination,
  RowMenu,
  SearchBox,
  StatCard,
  Toolbar,
  useUrlFilters,
  type MenuItem,
} from "../_components/kit";
import { usd } from "../_components/fmt";
import RejectModal from "./RejectModal";
import RepPanel from "./RepPanel";
import type { CountStat, RepData } from "./types";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Awaiting review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];
const RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

type Action = "approve" | "reject";

export default function RepsClient({
  reps,
  totalFiltered,
  stats,
  query,
  pageSize,
}: {
  reps: RepData[];
  totalFiltered: number;
  stats: { all: CountStat; pending: CountStat; approved: CountStat; rejected: CountStat };
  query: SignupQuery;
  pageSize: number;
}) {
  const router = useRouter();
  const update = useUrlFilters();
  const searchParams = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<RepData | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bulkNotice, setBulkNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  const active = reps.find((r) => r.id === activeId) ?? null;
  const rowsKey = reps.map((r) => r.id).join(",");

  // On a wide screen the first application is open straight away, like the reference design.
  // Closing the panel keeps it closed until the list itself changes.
  useEffect(() => {
    if (active || !reps[0] || dismissedFor === rowsKey) return;
    if (window.matchMedia("(min-width: 1280px)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveId(reps[0].id);
    }
  }, [active, reps, rowsKey, dismissedFor]);

  const allChecked = reps.length > 0 && reps.every((r) => checked.has(r.id));
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(reps.map((r) => r.id)));
  const toggleOne = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const open = (id: string, nextTab = "overview") => {
    setActiveId(id);
    setTab(nextTab);
    setError(null);
  };

  async function act(id: string, action: Action, reviewNotes?: string): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(`/api/lumera-ops/sales-reps/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewNotes }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: data.error ?? `Could not ${action} this application.` };
  }

  async function actOne(rep: RepData, action: Action, reviewNotes?: string): Promise<boolean> {
    setBusy(action);
    setError(null);
    try {
      const result = await act(rep.id, action, reviewNotes);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(null);
    }
  }

  // One after another, so the welcome emails and discount codes aren't all created at once.
  async function bulk(action: Action) {
    const targets = reps.filter((r) => checked.has(r.id) && !r.linkedAffiliateId && (action === "approve" || r.status === "pending"));
    if (targets.length === 0) {
      setBulkNotice({ tone: "bad", text: `None of the selected applications can be ${action === "approve" ? "approved" : "rejected"}.` });
      return;
    }
    if (!window.confirm(`${action === "approve" ? "Approve" : "Reject"} ${targets.length} application${targets.length === 1 ? "" : "s"}?`)) return;
    setBusy(action);
    setBulkNotice(null);
    const failed: string[] = [];
    try {
      for (const rep of targets) {
        const result = await act(rep.id, action);
        if (!result.ok) failed.push(`${rep.name}: ${result.error}`);
      }
    } finally {
      setBusy(null);
    }
    setChecked(new Set());
    router.refresh();
    setBulkNotice(
      failed.length
        ? { tone: "bad", text: `${targets.length - failed.length} done, ${failed.length} failed. ${failed.join(" ")}` }
        : { tone: "good", text: `${targets.length} application${targets.length === 1 ? "" : "s"} ${action === "approve" ? "approved" : "rejected"}.` },
    );
  }

  const exportParams = new URLSearchParams(searchParams.toString());
  exportParams.delete("page");
  exportParams.set("type", "sales-reps");
  const exportHref = `/api/lumera-ops/signups/export?${exportParams.toString()}`;
  const selectedHref = `/api/lumera-ops/signups/export?type=sales-reps&ids=${[...checked].join(",")}`;

  const menuFor = (r: RepData): MenuItem[] => [
    { label: "View details", onClick: () => open(r.id) },
    ...(r.hasResume ? [{ label: "Download resume", href: `/api/lumera-ops/sales-reps/${r.id}/resume` }] : []),
    ...(!r.linkedAffiliateId
      ? [
          { label: r.status === "rejected" ? "Approve instead" : "Approve", tone: "good" as const, onClick: () => { open(r.id); void actOne(r, "approve"); } },
          ...(r.status === "pending" ? [{ label: "Reject…", tone: "danger" as const, onClick: () => { open(r.id); setRejecting(r); } }] : []),
        ]
      : [{ label: "View affiliate account", href: `/lumera-ops/affiliates/${r.linkedAffiliateId}` }]),
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<FileText className="h-5 w-5" />}
          tone="bg-primary-light text-primary"
          label="Total applications"
          value={stats.all.total}
          trend={stats.all.trend}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          tone="bg-amber-100 text-amber-600"
          label="Awaiting review"
          value={stats.pending.total}
          trend={stats.pending.trend}
          note={stats.pending.total > 0 ? "Needs your attention" : "All caught up"}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="bg-green-100 text-green-600"
          label="Approved"
          value={stats.approved.total}
          trend={stats.approved.trend}
        />
        <StatCard
          icon={<XCircle className="h-5 w-5" />}
          tone="bg-error/10 text-error"
          label="Rejected"
          value={stats.rejected.total}
          trend={stats.rejected.trend}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          <Toolbar>
            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-1">
              <SearchBox initial={query.q} placeholder="Search by name, email or type of sales…" />
              <FilterSelect label="Status" value={query.status || "all"} onChange={(v) => update({ status: v })} options={STATUS_OPTIONS} />
              <FilterSelect label="Date range" value={query.range || "all"} onChange={(v) => update({ range: v })} options={RANGE_OPTIONS} />
              <FilterSelect
                label="Sort"
                value={query.sort}
                onChange={(v) => update({ sort: v === "newest" ? "" : v })}
                options={SORT_OPTIONS}
              />
            </div>
            <ExportButton href={exportHref} />
          </Toolbar>

          {bulkNotice && <Notice tone={bulkNotice.tone}>{bulkNotice.text}</Notice>}

          {checked.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/20 bg-primary-light/40 px-4 py-3">
              <span className="text-sm font-medium text-ink">{checked.size} selected</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => bulk("approve")}
                  disabled={busy !== null}
                  className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-green-700 transition hover:bg-green-50 disabled:opacity-50"
                >
                  {busy === "approve" ? "Approving…" : "Approve"}
                </button>
                <button
                  onClick={() => bulk("reject")}
                  disabled={busy !== null}
                  className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-error transition hover:bg-error/10 disabled:opacity-50"
                >
                  {busy === "reject" ? "Rejecting…" : "Reject"}
                </button>
                <a
                  href={selectedHref}
                  className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink/80 transition hover:bg-page-bg"
                >
                  Export selected
                </a>
                <button onClick={() => setChecked(new Set())} className="px-3 py-1.5 text-xs font-medium text-ink/60 transition hover:text-ink">
                  Clear
                </button>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-left text-sm">
                <thead className="border-b border-line bg-page-bg/50 text-xs font-semibold text-ink/60">
                  <tr>
                    <th className="w-12 px-5 py-4 text-center">
                      <input
                        type="checkbox"
                        aria-label="Select all applications on this page"
                        checked={allChecked}
                        onChange={toggleAll}
                        className="cursor-pointer rounded border-line text-primary focus:ring-primary/20"
                      />
                    </th>
                    <th className="px-4 py-4">Applicant</th>
                    <th className="px-4 py-4">Type of sales</th>
                    <th className="px-4 py-4">Annual sales</th>
                    <th className="px-4 py-4">Referred by</th>
                    <th className="px-4 py-4">Applied on</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {reps.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center font-medium text-ink/50">
                        No applications match these filters.
                      </td>
                    </tr>
                  )}
                  {reps.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => open(r.id)}
                      className={`cursor-pointer transition hover:bg-page-bg/40 ${r.id === activeId ? "bg-primary-light/40" : ""}`}
                    >
                      <td className="px-5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.name}`}
                          checked={checked.has(r.id)}
                          onChange={() => toggleOne(r.id)}
                          className="cursor-pointer rounded border-line text-primary focus:ring-primary/20"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.name} />
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-ink">{r.name}</div>
                            <div className="truncate text-xs text-ink/50">{r.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {r.salesType ? (
                          <span className="rounded-md bg-page-bg px-2 py-0.5 text-xs font-medium text-ink/70">{r.salesType}</span>
                        ) : (
                          <span className="text-ink/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-ink/80">{r.annualGrossSales != null ? usd(r.annualGrossSales) : "—"}</td>
                      <td className="px-4 py-3.5 text-ink/70">{r.referrer ?? "—"}</td>
                      <td className="px-4 py-3.5 font-medium text-ink/70">{r.appliedOn}</td>
                      <td className="px-4 py-3.5">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <RowMenu items={menuFor(r)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={query.page} pageSize={pageSize} total={totalFiltered} noun="applications" />
          </div>
        </div>

        {active ? (
          <RepPanel
            key={active.id}
            rep={active}
            tab={tab}
            onTab={setTab}
            onClose={() => {
              setActiveId(null);
              setDismissedFor(rowsKey);
            }}
            onApprove={() => void actOne(active, "approve")}
            onReject={() => {
              setError(null);
              setRejecting(active);
            }}
            busy={busy !== null}
            error={rejecting ? null : error}
          />
        ) : (
          <EmptyPanel text="Select an application to review the applicant." />
        )}
      </div>

      {rejecting && (
        <RejectModal
          rep={rejecting}
          busy={busy === "reject"}
          error={error}
          onCancel={() => {
            setRejecting(null);
            setError(null);
          }}
          onConfirm={async (notes) => {
            if (await actOne(rejecting, "reject", notes)) setRejecting(null);
          }}
        />
      )}
    </div>
  );
}
