"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  ShoppingCart, DollarSign, Clock, CheckCircle2, Search, Download,
  ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Link as LinkIcon, RotateCcw,
  Ban
} from "lucide-react";

export function ConversionsClient({
  initialConversions,
  totalFiltered,
  page,
  pageSize,
  stats,
  searchQuery,
  currentStatus,
  currentSource,
  currentDateRange,
  availableSources
}: {
  initialConversions: any[];
  totalFiltered: number;
  page: number;
  pageSize: number;
  stats: any;
  searchQuery: string;
  currentStatus: string;
  currentSource: string;
  currentDateRange: string;
  availableSources: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchQuery);
  const [status, setStatus] = useState(currentStatus);
  const [source, setSource] = useState(currentSource);
  const [dateRange, setDateRange] = useState(currentDateRange);

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
    if (updates.source !== undefined) {
      if (updates.source && updates.source !== "all") params.set("source", updates.source);
      else params.delete("source");
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

  const handleReset = () => {
    setQ("");
    setStatus("all");
    setSource("all");
    setDateRange("all");
    router.push("?");
  };

  const handleExport = () => {
    const headers = ["ID", "Order", "Affiliate Email", "Source", "Commission", "Status", "Date"];
    const rows = initialConversions.map(c => [
      c.id,
      c.shopifyOrderName || "",
      c.affiliate?.userEmail || "",
      c.attributionSource || "",
      c.commissionAmount,
      c.status,
      new Date(c.createdAt).toISOString()
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "conversions_export.csv");
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
          <h1 className="font-heading text-3xl font-bold text-ink">Conversions</h1>
          <p className="mt-1.5 text-sm text-ink/60 font-medium">
            Track orders, commissions, and affiliate performance in real time.
          </p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-line rounded-xl hover:bg-page-bg transition shadow-sm bg-white">
          <Download className="w-4 h-4 text-ink/60" />
          Export
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard 
          icon={<ShoppingCart className="w-5 h-5" />} 
          iconBg="bg-primary-light" 
          iconColor="text-primary"
          label="Total Orders" 
          value={stats.totalOrders.total} 
          trend={stats.totalOrders.trend} 
        />
        <StatCard 
          icon={<DollarSign className="w-5 h-5" />} 
          iconBg="bg-blue-100" 
          iconColor="text-blue-600"
          label="Total Commission" 
          value={`$${stats.totalCommission.total.toFixed(2)}`} 
          trend={stats.totalCommission.trend} 
        />
        <StatCard 
          icon={<Clock className="w-5 h-5" />} 
          iconBg="bg-indigo-100" 
          iconColor="text-indigo-600"
          label="Pending Commission" 
          value={`$${stats.pendingCommission.total.toFixed(2)}`} 
          trend={stats.pendingCommission.trend} 
        />
        <StatCard 
          icon={<CheckCircle2 className="w-5 h-5" />} 
          iconBg="bg-green-100" 
          iconColor="text-green-600"
          label="Paid Commission" 
          value={`$${stats.paidCommission.total.toFixed(2)}`} 
          trend={stats.paidCommission.trend} 
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <SelectFilter 
            icon={<LinkIcon className="w-4 h-4" />}
            value={source}
            onChange={(val: string) => { setSource(val); updateFilters({ source: val, page: 1 }); }}
            options={[
              { label: "All Sources", value: "all" },
              ...availableSources.map(s => ({ label: s.replace("_", " "), value: s }))
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
              { label: "Reversed", value: "reversed" },
              { label: "Voided", value: "voided" },
            ]}
          />
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
          <button 
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-line transition text-ink/70"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-line overflow-hidden">
        <div className="p-6 border-b border-line flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="font-heading text-lg font-bold text-ink">Most recent {Math.min(pageSize, totalFiltered)} orders</h2>
            <p className="text-sm text-ink/60 font-medium mt-1">Showing the latest affiliate conversions from your store.</p>
          </div>
          <div className="relative w-full sm:w-auto min-w-[250px]">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-ink/40" />
            <input 
              type="text" 
              placeholder="Search orders, emails..." 
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-page-bg border border-transparent hover:border-line focus:border-primary/30 text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition placeholder:text-ink/40"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-page-bg/50 border-b border-line text-xs font-semibold text-ink/60">
              <tr>
                <th className="px-6 py-4">Order</th>
                <th className="px-6 py-4">Affiliate</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Commission</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {initialConversions.length > 0 ? initialConversions.map(c => (
                <ConversionRow key={c.id} conversion={c} />
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-ink/50 font-medium">
                    No conversions found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-6 py-4 border-t border-line flex items-center justify-between bg-page-bg/30">
          <div className="text-sm text-ink/60 font-medium">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalFiltered)} of {totalFiltered} orders
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
        className="appearance-none bg-white border border-line hover:border-ink/20 text-sm font-medium rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition cursor-pointer shadow-sm"
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

function ConversionRow({ conversion }: { conversion: any }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isReversing, setIsReversing] = useState(false);

  const canReverse = ["pending", "approved"].includes(conversion.status);
  
  const handleReverse = async () => {
    setIsReversing(true);
    try {
      const res = await fetch(`/api/lumera-ops/conversions/${conversion.id}/reverse`, {
        method: "POST",
      });
      if (res.ok) {
        setShowConfirm(false);
        router.refresh();
      }
    } finally {
      setIsReversing(false);
    }
  };

  return (
    <>
      <tr className="hover:bg-page-bg/30 transition group">
        <td className="px-6 py-4 font-semibold text-primary hover:underline">
          <Link href={conversion.shopifyOrderId ? `https://lumera-ops.shopify.com/store/lumeramd/orders/${conversion.shopifyOrderId}` : "#"} target="_blank" className="flex items-center gap-1.5">
            {conversion.shopifyOrderName || "—"}
            <LinkIcon className="w-3 h-3 text-primary/70" />
          </Link>
        </td>
        <td className="px-6 py-4 font-medium text-ink/80">
          {conversion.affiliate?.userEmail || "—"}
        </td>
        <td className="px-6 py-4">
          <span className="inline-block bg-primary/10 text-primary-dark font-semibold text-xs px-2.5 py-1 rounded-full capitalize">
            {conversion.attributionSource?.replace("_", " ") || "—"}
          </span>
        </td>
        <td className="px-6 py-4 font-semibold text-ink/90">
          ${conversion.commissionAmount.toFixed(2)}
        </td>
        <td className="px-6 py-4">
          <StatusBadge status={conversion.status} />
        </td>
        <td className="px-6 py-4 text-ink/70 font-medium text-sm">
          {new Date(conversion.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </td>
        <td className="px-6 py-4 text-center">
          <div className="flex justify-center items-center gap-2">
            {canReverse ? (
              <button 
                onClick={() => setShowConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs font-medium text-ink/70 hover:bg-page-bg transition shadow-sm bg-white"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reverse
              </button>
            ) : (
              <span className="text-ink/30 font-medium">—</span>
            )}
            <ActionMenu conversion={conversion} />
          </div>
        </td>
      </tr>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 whitespace-normal" onClick={() => !isReversing && setShowConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-error/10 text-error flex items-center justify-center mb-4 mx-auto">
                <Ban className="w-6 h-6" />
              </div>
              <h3 className="text-center font-heading font-bold text-lg text-ink mb-2">Reverse Conversion?</h3>
              <p className="text-center text-ink/70 text-sm font-medium mb-6">
                Are you sure you want to reverse the commission for order <strong className="text-ink">{conversion.shopifyOrderName}</strong>? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowConfirm(false)}
                  disabled={isReversing}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-line text-ink/70 hover:bg-page-bg transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleReverse}
                  disabled={isReversing}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-error text-white hover:bg-error/90 transition disabled:opacity-50"
                >
                  {isReversing ? "Reversing..." : "Reverse"}
                </button>
              </div>
            </div>
          </div>
        </div>
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
  } else if (status === 'reversed') {
    style = "bg-error/10 text-error";
    icon = <RotateCcw className="w-3.5 h-3.5" />;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${style}`}>
      {icon}
      {status}
    </span>
  );
}

function ActionMenu({ conversion }: { conversion: any }) {
  const [isOpen, setIsOpen] = useState(false);
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

  return (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button 
        ref={buttonRef}
        onClick={openDropdown}
        className="p-1.5 rounded-lg border border-line text-ink/50 hover:text-ink hover:bg-page-bg transition bg-white"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {isOpen && (
        <div 
          style={{ top: dropdownPos.top, right: dropdownPos.right }}
          className="fixed z-[100] w-48 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-line overflow-hidden"
        >
          <div className="py-1">
            <Link 
              href={`/lumera-ops/affiliates/${conversion.affiliateId}`}
              className="block px-4 py-2 text-sm text-ink/80 hover:bg-page-bg hover:text-primary transition text-left"
            >
              View Affiliate
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
