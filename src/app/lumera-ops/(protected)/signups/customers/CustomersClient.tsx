"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, Clock, UserCheck, Users } from "lucide-react";
import Avatar from "@/components/Avatar";
import StatusPill from "@/components/StatusPill";
import { formatPoints } from "@/lib/wallet/rules";
import type { SignupQuery } from "@/lib/admin/signupFilters";
import {
  EmptyPanel,
  ExportButton,
  FilterSelect,
  Pagination,
  RowMenu,
  SearchBox,
  StatCard,
  Toolbar,
  useUrlFilters,
  type MenuItem,
} from "../_components/kit";
import { usd } from "../_components/fmt";
import CancelModal from "./CancelModal";
import CustomerPanel from "./CustomerPanel";
import type { CountStat, CustomerData } from "./types";

const PLAN_OPTIONS = [
  { value: "all", label: "All plans" },
  { value: "customer_basic", label: "Basic" },
  { value: "customer_plus", label: "Plus" },
  { value: "customer_premium", label: "Premium" },
  { value: "agent", label: "Premium (rep)" },
];
const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "pending_payment", label: "Awaiting payment" },
  { value: "past_due", label: "Past due" },
  { value: "cancelled", label: "Cancelled" },
  { value: "complimentary", label: "Complimentary" },
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

export default function CustomersClient({
  customers,
  totalFiltered,
  stats,
  query,
  pageSize,
}: {
  customers: CustomerData[];
  totalFiltered: number;
  stats: { all: CountStat; active: CountStat; awaitingPayment: CountStat; lapsed: CountStat };
  query: SignupQuery;
  pageSize: number;
}) {
  const update = useUrlFilters();
  const searchParams = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const [payIntent, setPayIntent] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [cancelFor, setCancelFor] = useState<CustomerData | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  const active = customers.find((c) => c.id === activeId) ?? null;
  const rowsKey = customers.map((c) => c.id).join(",");

  // On a wide screen the first member is open straight away, like the reference design. Closing the
  // panel keeps it closed until the list itself changes.
  useEffect(() => {
    if (active || !customers[0] || dismissedFor === rowsKey) return;
    if (window.matchMedia("(min-width: 1280px)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveId(customers[0].id);
    }
  }, [active, customers, rowsKey, dismissedFor]);

  const allChecked = customers.length > 0 && customers.every((c) => checked.has(c.id));
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(customers.map((c) => c.id)));
  const toggleOne = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const open = (id: string, nextTab = "overview", pay = false) => {
    setActiveId(id);
    setTab(nextTab);
    setPayIntent(pay);
  };

  const exportParams = new URLSearchParams(searchParams.toString());
  exportParams.delete("page");
  exportParams.set("type", "customers");
  const exportHref = `/api/lumera-ops/signups/export?${exportParams.toString()}`;
  const selectedHref = `/api/lumera-ops/signups/export?type=customers&ids=${[...checked].join(",")}`;

  const menuFor = (c: CustomerData): MenuItem[] => [
    { label: "View details", onClick: () => open(c.id) },
    { label: c.status === "cancelled" ? "Reactivate with payment" : "Record payment", onClick: () => open(c.id, "payments", true) },
    ...(c.payLink
      ? [{ label: "Copy payment link", onClick: () => void navigator.clipboard?.writeText(c.payLink!) }]
      : []),
    ...(c.status !== "cancelled" ? [{ label: "Cancel membership", tone: "danger" as const, onClick: () => setCancelFor(c) }] : []),
  ];

  const activePercent = stats.all.total ? Math.round((stats.active.total / stats.all.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          tone="bg-primary-light text-primary"
          label="Total members"
          value={stats.all.total}
          trend={stats.all.trend}
        />
        <StatCard
          icon={<UserCheck className="h-5 w-5" />}
          tone="bg-green-100 text-green-600"
          label="Active members"
          value={stats.active.total}
          trend={stats.active.trend}
          note={`${activePercent}% of total`}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          tone="bg-amber-100 text-amber-600"
          label="Awaiting payment"
          value={stats.awaitingPayment.total}
          trend={stats.awaitingPayment.trend}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="bg-error/10 text-error"
          label="Past due / cancelled"
          value={stats.lapsed.total}
          trend={stats.lapsed.trend}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          <Toolbar>
            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-1">
              <SearchBox initial={query.q} placeholder="Search by name, email or phone…" />
              <FilterSelect label="Plan" value={query.plan || "all"} onChange={(v) => update({ plan: v })} options={PLAN_OPTIONS} />
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

          {checked.size > 0 && (
            <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary-light/40 px-4 py-3">
              <span className="text-sm font-medium text-ink">{checked.size} selected</span>
              <div className="flex items-center gap-2">
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
                        aria-label="Select all members on this page"
                        checked={allChecked}
                        onChange={toggleAll}
                        className="cursor-pointer rounded border-line text-primary focus:ring-primary/20"
                      />
                    </th>
                    <th className="px-4 py-4">Member</th>
                    <th className="px-4 py-4">Plan</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Points</th>
                    <th className="px-4 py-4">Referred by</th>
                    <th className="px-4 py-4">Joined</th>
                    <th className="px-4 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center font-medium text-ink/50">
                        No members match these filters.
                      </td>
                    </tr>
                  )}
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => open(c.id)}
                      className={`cursor-pointer transition hover:bg-page-bg/40 ${c.id === activeId ? "bg-primary-light/40" : ""}`}
                    >
                      <td className="px-5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${c.name}`}
                          checked={checked.has(c.id)}
                          onChange={() => toggleOne(c.id)}
                          className="cursor-pointer rounded border-line text-primary focus:ring-primary/20"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={c.name} />
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-ink">{c.name}</div>
                            <div className="truncate text-xs text-ink/50">{c.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-ink">{c.planLabel}</div>
                        <div className="text-xs text-ink/50">
                          {usd(c.monthlyPrice)}/mo{c.wantsTestKit ? ` · test kit ${usd(c.testKitPrice)}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusPill status={c.status} />
                        {c.complimentary && c.status === "active" ? (
                          <div className="mt-1 text-xs text-ink/50">Complimentary</div>
                        ) : (
                          c.status === "active" &&
                          c.currentPeriodEnd && <div className="mt-1 text-xs text-ink/50">through {c.currentPeriodEnd}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-ink/80">{formatPoints(c.pointsCents)}</td>
                      <td className="px-4 py-3.5 text-ink/70">{c.referrer ?? "—"}</td>
                      <td className="px-4 py-3.5 font-medium text-ink/70">{c.signedUp}</td>
                      <td className="px-4 py-3.5 text-center">
                        <RowMenu items={menuFor(c)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={query.page} pageSize={pageSize} total={totalFiltered} noun="members" />
          </div>
        </div>

        {active ? (
          <CustomerPanel
            key={active.id}
            customer={active}
            tab={tab}
            onTab={(t) => {
              setTab(t);
              setPayIntent(false);
            }}
            onClose={() => {
              setActiveId(null);
              setDismissedFor(rowsKey);
            }}
            onCancel={() => setCancelFor(active)}
            payIntent={payIntent}
            onPayIntent={() => {
              setTab("payments");
              setPayIntent(true);
            }}
          />
        ) : (
          <EmptyPanel text="Select a member to see their plan, payments and points." />
        )}
      </div>

      {cancelFor && <CancelModal customer={cancelFor} onClose={() => setCancelFor(null)} />}
    </div>
  );
}
