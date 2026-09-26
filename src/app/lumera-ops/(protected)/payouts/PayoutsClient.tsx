"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  DollarSign, Clock, CheckCircle2, Users, Search, Download, Plus,
  ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Ban
} from "lucide-react";
import Avatar from "@/components/Avatar";

export function PayoutsClient({
  initialPayouts,
  totalFiltered,
  page,
  pageSize,
  stats,
  searchQuery,
  currentStatus,
  currentMethod,
  currentDateRange,
  availableMethods,
  affiliates
}: {
  initialPayouts: any[];
  totalFiltered: number;
  page: number;
  pageSize: number;
  stats: any;
  searchQuery: string;
  currentStatus: string;
  currentMethod: string;
  currentDateRange: string;
  availableMethods: string[];
  affiliates: any[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchQuery);
  const [status, setStatus] = useState(currentStatus);
  const [method, setMethod] = useState(currentMethod);
  const [dateRange, setDateRange] = useState(currentDateRange);

  const [showManualModal, setShowManualModal] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (q !== searchQuery) {
        updateFilters({ q, page: 1 });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [q, searchQuery]);

  const updateFilters = (updates: any) => {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.q !== undefined) {
      if (updates.q) params.set("q", updates.q);
      else params.delete("q");
    }
    if (updates.status !== undefined) {
      if (updates.status && updates.status !== "all") params.set("status", updates.status);
      else params.delete("status");
    }
    if (updates.method !== undefined) {
      if (updates.method && updates.method !== "all") params.set("method", updates.method);
      else params.delete("method");
    }
    if (updates.dateRange !== undefined) {
      if (updates.dateRange && updates.dateRange !== "all") params.set("dateRange", updates.dateRange);
      else params.delete("dateRange");
    }
    if (updates.page !== undefined) {
      if (updates.page > 1) params.set("page", updates.page.toString());
      else params.delete("page");
    }
    router.push(`?${params.toString()}`);
  };

  const handleExport = () => {
    const headers = ["Payout ID", "Affiliate", "Amount", "Method", "Status", "Transaction ID", "Date"];
    const rows = initialPayouts.map(p => [
      p.id,
      p.affiliate?.userEmail || "",
      p.amount,
      p.payoutMethod || "",
      p.status,
      p.transactionId || "",
      new Date(p.createdAt).toISOString()
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "payouts_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.ceil(totalFiltered / pageSize);

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-ink">Payouts</h1>
          <p className="mt-1.5 text-sm text-ink/60 font-medium">
            Manage affiliate payouts, track payment history, and process commissions.
          </p>
        </div>
        <button 
          onClick={() => setShowManualModal(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-medium text-sm transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Manual Payout
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard 
          icon={<DollarSign className="w-5 h-5" />} 
          iconBg="bg-blue-100" 
          iconColor="text-blue-600"
          label="Total Payouts" 
          value={`$${stats.totalPayouts.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} 
          trend={stats.totalPayouts.trend} 
        />
        <StatCard 
          icon={<Clock className="w-5 h-5" />} 
          iconBg="bg-orange-100" 
          iconColor="text-orange-600"
          label="Pending Payouts" 
          value={`$${stats.pendingPayouts.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} 
          trend={stats.pendingPayouts.trend} 
        />
        <StatCard 
          icon={<CheckCircle2 className="w-5 h-5" />} 
          iconBg="bg-green-100" 
          iconColor="text-green-600"
          label="Paid Payouts" 
          value={`$${stats.paidPayouts.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} 
          trend={stats.paidPayouts.trend} 
        />
        <StatCard 
          icon={<Users className="w-5 h-5" />} 
          iconBg="bg-purple-100" 
          iconColor="text-purple-600"
          label="Affiliates Paid" 
          value={stats.affiliatesPaid.total} 
          trend={stats.affiliatesPaid.trend} 
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white p-2 rounded-2xl shadow-sm border border-line">
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <SelectFilter 
            icon={<Clock className="w-4 h-4" />}
            value={dateRange}
            onChange={(val: string) => { setDateRange(val); updateFilters({ dateRange: val, page: 1 }); }}
            options={[
              { label: "All Time", value: "all" },
              { label: "Last 7 Days", value: "last7" },
              { label: "Last 30 Days", value: "last30" },
              { label: "This Month", value: "thisMonth" }
            ]}
          />
          <SelectFilter 
            icon={<Clock className="w-4 h-4" />}
            value={status}
            onChange={(val: string) => { setStatus(val); updateFilters({ status: val, page: 1 }); }}
            options={[
              { label: "All Statuses", value: "all" },
              { label: "Pending", value: "pending" },
              { label: "Approved", value: "approved" },
              { label: "Paid", value: "paid" },
              { label: "Rejected", value: "rejected" },
            ]}
          />
          <SelectFilter 
            icon={<DollarSign className="w-4 h-4" />}
            value={method}
            onChange={(val: string) => { setMethod(val); updateFilters({ method: val, page: 1 }); }}
            options={[
              { label: "All Methods", value: "all" },
              ...availableMethods.map(m => ({ label: m, value: m }))
            ]}
          />

          <div className="relative flex-1 min-w-[250px]">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-ink/40" />
            <input 
              type="text" 
              placeholder="Search by affiliate, email, or payout ID..." 
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-page-bg border border-transparent hover:border-line focus:border-primary/30 text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition placeholder:text-ink/40"
            />
          </div>
        </div>

        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-line rounded-xl hover:bg-page-bg transition shrink-0 w-full lg:w-auto justify-center">
          <Download className="w-4 h-4 text-ink/60" />
          Export
        </button>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-line overflow-hidden">
        <div className="p-6 border-b border-line">
          <h2 className="font-heading text-lg font-bold text-ink">Payouts</h2>
          <p className="text-sm text-ink/60 font-medium mt-1">All affiliate payouts and their current status.</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-page-bg/50 border-b border-line text-xs font-semibold text-ink/60">
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <input type="checkbox" className="rounded border-line text-primary focus:ring-primary/20 cursor-pointer" />
                </th>
                <th className="px-6 py-4">Payout ID</th>
                <th className="px-6 py-4">Affiliate</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4">Period</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Paid Date</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {initialPayouts.length > 0 ? initialPayouts.map(p => (
                <PayoutRow key={p.id} payout={p} />
              )) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-ink/50 font-medium">
                    No payouts found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-6 py-4 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 bg-page-bg/30">
          <div className="text-sm text-ink/60 font-medium">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalFiltered)} of {totalFiltered} payouts
          </div>
          <div className="flex items-center gap-1">
            <button 
              disabled={page <= 1}
              onClick={() => updateFilters({ page: page - 1 })}
              className="p-1.5 rounded-lg border border-line text-ink/60 hover:text-ink hover:bg-white disabled:opacity-50 transition bg-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center px-2">
              <span className="w-8 h-8 flex items-center justify-center bg-primary text-white font-medium rounded-lg text-sm">
                {page}
              </span>
            </div>
            <button 
              disabled={page >= totalPages}
              onClick={() => updateFilters({ page: page + 1 })}
              className="p-1.5 rounded-lg border border-line text-ink/60 hover:text-ink hover:bg-white disabled:opacity-50 transition bg-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {showManualModal && (
        <ManualPayoutModal onClose={() => setShowManualModal(false)} affiliates={affiliates} />
      )}
    </div>
  );
}

function StatCard({ icon, iconBg, iconColor, label, value, trend }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-line shadow-sm flex flex-col justify-center relative overflow-hidden group">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2.5 rounded-xl ${iconBg} ${iconColor}`}>
          {icon}
        </div>
        <span className="text-sm font-semibold text-ink/70">{label}</span>
      </div>
      <div className="font-heading text-3xl font-bold text-ink mb-1">{value}</div>
      <div className="flex items-center gap-1.5 text-xs font-medium">
        {trend > 0 ? (
          <span className="text-green-600 flex items-center">↑ {trend}%</span>
        ) : trend < 0 ? (
          <span className="text-error flex items-center">↓ {Math.abs(trend)}%</span>
        ) : (
          <span className="text-ink/40 flex items-center">↑ 0%</span>
        )}
        <span className="text-ink/40">vs. previous 30 days</span>
      </div>
    </div>
  );
}

function SelectFilter({ icon, value, onChange, options }: any) {
  return (
    <div className="relative">
      <select 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-page-bg border border-transparent hover:border-line text-sm font-medium rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition cursor-pointer"
      >
        {options.map((o: any) => (
          <option key={o.value} value={o.value} className="capitalize">{o.label}</option>
        ))}
      </select>
      <div className="absolute left-3.5 top-3 text-ink/50 pointer-events-none">
        {icon}
      </div>
      <ChevronDown className="w-4 h-4 absolute right-3.5 top-3 text-ink/50 pointer-events-none" />
    </div>
  );
}

function PayoutRow({ payout }: { payout: any }) {
  const [showEdit, setShowEdit] = useState(false);

  // Real period = the date range of the conversions this payout actually covers (computed
  // server-side from payout.conversionIds). Manual payouts cover no conversions, so there's
  // no real period to show.
  const period = payout.periodStart && payout.periodEnd
    ? new Date(payout.periodStart).toDateString() === new Date(payout.periodEnd).toDateString()
      ? new Date(payout.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : `${new Date(payout.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(payout.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : "—";

  const paidDate = payout.status === "paid" && payout.updatedAt ? new Date(payout.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric'}) : "—";

  return (
    <>
      <tr className="hover:bg-page-bg/30 transition group">
        <td className="px-6 py-4 text-center">
          <input type="checkbox" className="rounded border-line text-primary focus:ring-primary/20 cursor-pointer" />
        </td>
        <td className="px-6 py-4 font-mono text-xs font-semibold text-ink/70">
          {payout.id.length > 15 ? `PAY-...${payout.id.substring(payout.id.length - 4)}` : payout.id}
        </td>
        <td className="px-6 py-4">
          <Link href={`/lumera-ops/affiliates/${payout.affiliateId}`} className="flex items-center gap-3">
            <Avatar name={payout.affiliate?.displayName || payout.affiliate?.userEmail || ""} size="md" />
            <div>
              <div className="font-semibold text-ink group-hover:text-primary transition">{payout.affiliate?.displayName || payout.affiliate?.userEmail}</div>
              {payout.affiliate?.displayName && <div className="text-xs text-ink/50 font-medium mt-0.5">{payout.affiliate?.userEmail}</div>}
            </div>
          </Link>
        </td>
        <td className="px-6 py-4 font-semibold text-ink/90">
          ${payout.amount.toFixed(2)}
        </td>
        <td className="px-6 py-4 text-ink/80 font-medium">
          {payout.payoutMethod || "—"}
        </td>
        <td className="px-6 py-4 text-ink/60 font-medium text-sm">
          {period}
        </td>
        <td className="px-6 py-4">
          <StatusBadge status={payout.status} />
        </td>
        <td className="px-6 py-4 text-ink/70 font-medium text-sm">
          {paidDate}
        </td>
        <td className="px-6 py-4 text-center">
          <ActionMenu payout={payout} onEdit={() => setShowEdit(true)} />
        </td>
      </tr>

      {showEdit && (
        <EditPayoutModal payout={payout} onClose={() => setShowEdit(false)} />
      )}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  let style = "bg-page-bg text-ink/60";
  let icon = null;

  if (status === 'pending') {
    style = "bg-orange-50 text-orange-600";
    icon = <Clock className="w-3.5 h-3.5" />;
  } else if (status === 'approved' || status === 'paid') {
    style = "bg-[#E7F7ED] text-[#14833D]";
    icon = <CheckCircle2 className="w-3.5 h-3.5" />;
  } else if (status === 'rejected' || status === 'failed') {
    style = "bg-error/10 text-error";
    icon = <Ban className="w-3.5 h-3.5" />;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${style}`}>
      {icon}
      {status}
    </span>
  );
}

function ActionMenu({ payout, onEdit }: { payout: any, onEdit: () => void }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!isOpen) return;
    const close = () => setIsOpen(false);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [isOpen]);

  const openDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
      setIsOpen(true);
    }
  };

  const updateStatus = async (status: string) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/lumera-ops/payouts/${payout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) router.refresh();
    } finally {
      setIsUpdating(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button 
        ref={buttonRef}
        onClick={openDropdown}
        className="p-1.5 rounded-lg border border-line text-ink/50 hover:text-ink hover:bg-page-bg transition bg-white shadow-sm"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {isOpen && (
        <div 
          style={{ top: dropdownPos.top, right: dropdownPos.right }}
          className="fixed z-[100] w-48 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-line overflow-hidden"
        >
          <div className="py-1">
            <button
              onClick={() => { setIsOpen(false); onEdit(); }}
              className="block w-full text-left px-4 py-2 text-sm text-ink/80 hover:bg-page-bg hover:text-primary transition font-medium"
            >
              Edit Payout
            </button>
            <div className="border-t border-line my-1"></div>
            
            {payout.status === 'pending' && (
              <>
                <button
                  onClick={() => updateStatus("approved")}
                  disabled={isUpdating}
                  className="block w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 transition font-medium"
                >
                  Approve Payout
                </button>
                <button
                  onClick={() => updateStatus("rejected")}
                  disabled={isUpdating}
                  className="block w-full text-left px-4 py-2 text-sm text-error hover:bg-error/10 transition font-medium"
                >
                  Reject Payout
                </button>
              </>
            )}

            {payout.status === 'approved' && (
              <button
                onClick={() => updateStatus("paid")}
                disabled={isUpdating}
                className="block w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 transition font-medium"
              >
                Mark as Paid
              </button>
            )}

            {(payout.status === 'paid' || payout.status === 'rejected') && (
              <button
                onClick={() => updateStatus("pending")}
                disabled={isUpdating}
                className="block w-full text-left px-4 py-2 text-sm text-ink/60 hover:bg-page-bg transition font-medium"
              >
                Mark as Pending
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EditPayoutModal({ payout, onClose }: { payout: any, onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    amount: payout.amount.toString(),
    payoutMethod: payout.payoutMethod || "",
    status: payout.status,
    transactionId: payout.transactionId || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch(`/api/lumera-ops/payouts/${payout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Error ${res.status}: Failed to save payout`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save payout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 whitespace-normal" onClick={() => !loading && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-line flex items-center justify-between bg-page-bg/50">
          <h2 className="font-heading text-lg font-bold text-ink">Edit Payout</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink transition">
            <Ban className="w-5 h-5 rotate-45" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-error/10 text-error text-sm rounded-xl font-medium border border-error/20">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink/80 block">Amount ($)</label>
            <input 
              required
              type="number"
              step="0.01"
              value={form.amount}
              onChange={e => setForm({...form, amount: e.target.value})}
              className="w-full bg-white border border-line focus:border-primary/50 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-primary/10 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink/80 block">Payment Method</label>
            <input 
              type="text" 
              value={form.payoutMethod}
              onChange={e => setForm({...form, payoutMethod: e.target.value})}
              className="w-full bg-white border border-line focus:border-primary/50 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-primary/10 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink/80 block">Status</label>
            <select 
              value={form.status}
              onChange={e => setForm({...form, status: e.target.value})}
              className="w-full bg-white border border-line focus:border-primary/50 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-primary/10 transition appearance-none"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink/80 block">Transaction ID (Optional)</label>
            <input 
              type="text" 
              value={form.transactionId}
              onChange={e => setForm({...form, transactionId: e.target.value})}
              className="w-full bg-white border border-line focus:border-primary/50 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-primary/10 transition"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-line text-ink/70 hover:bg-page-bg transition"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark transition disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ManualPayoutModal({ onClose, affiliates }: { onClose: () => void, affiliates: any[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    affiliateId: affiliates.length > 0 ? affiliates[0].id : "",
    amount: "",
    payoutMethod: "Manual",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch(`/api/lumera-ops/payouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        router.refresh();
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 whitespace-normal">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-line flex items-center justify-between bg-page-bg/50">
          <h2 className="font-heading text-lg font-bold text-ink">Manual Payout</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink transition">
            <Ban className="w-5 h-5 rotate-45" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink/80 block">Select Affiliate</label>
            <select 
              required
              value={form.affiliateId}
              onChange={e => setForm({...form, affiliateId: e.target.value})}
              className="w-full bg-white border border-line focus:border-primary/50 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-primary/10 transition appearance-none"
            >
              <option value="" disabled>Select an affiliate...</option>
              {affiliates.map(a => (
                <option key={a.id} value={a.id}>{a.displayName || a.userEmail}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink/80 block">Amount ($)</label>
            <input 
              required
              type="number"
              step="0.01"
              value={form.amount}
              onChange={e => setForm({...form, amount: e.target.value})}
              className="w-full bg-white border border-line focus:border-primary/50 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-primary/10 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink/80 block">Payment Method</label>
            <input 
              type="text" 
              value={form.payoutMethod}
              onChange={e => setForm({...form, payoutMethod: e.target.value})}
              placeholder="e.g. PayPal, Cash, Bonus"
              className="w-full bg-white border border-line focus:border-primary/50 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-primary/10 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink/80 block">Internal Notes (Optional)</label>
            <textarea 
              value={form.notes}
              onChange={e => setForm({...form, notes: e.target.value})}
              className="w-full bg-white border border-line focus:border-primary/50 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-primary/10 transition resize-none h-20"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-line text-ink/70 hover:bg-page-bg transition"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark transition disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Payout"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
