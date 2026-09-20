"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  ShoppingCart, DollarSign, Clock, CheckCircle2, Search,
  ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Info, Mail, Gift, ArrowRight
} from "lucide-react";
import { ShareDialog } from "../ShareButton";

export function AffiliateConversionsClient({
  affiliateId,
  referralLink,
  discountCode,
  initialConversions,
  totalFiltered,
  page,
  pageSize,
  stats,
  searchQuery,
  currentStatus,
}: {
  affiliateId: string;
  referralLink: string;
  discountCode: string | null;
  initialConversions: any[];
  totalFiltered: number;
  page: number;
  pageSize: number;
  stats: any;
  searchQuery: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchQuery);
  const [status, setStatus] = useState(currentStatus);
  const [dateRange, setDateRange] = useState("last30");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

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
    if (updates.page !== undefined) {
      if (updates.page > 1) params.set("page", updates.page.toString());
      else params.delete("page");
    }
    router.push(`?${params.toString()}`);
  };

  const totalPages = Math.ceil(totalFiltered / pageSize);

  return (
    <div className="space-y-6 md:space-y-8 p-4 md:p-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="animate-fade-up">
          <div className="flex items-center gap-2 text-sm font-medium text-ink/60 mb-2">
            <Link href="." className="hover:text-primary transition">Dashboard</Link>
            <span>&gt;</span>
            <span className="text-ink">Conversions</span>
          </div>
          <h1 className="font-heading text-3xl font-bold text-ink">Conversions</h1>
          <p className="mt-1.5 text-sm text-ink/60 font-medium">
            Every order credited to you through your link or discount code.
          </p>
        </div>
        
        <div className="relative shrink-0">
          <select 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="appearance-none bg-white border border-line hover:border-ink/20 text-sm font-semibold rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition cursor-pointer shadow-sm"
          >
            <option value="last7">Last 7 days</option>
            <option value="last30">Last 30 days</option>
            <option value="thisMonth">This month</option>
            <option value="all">All time</option>
          </select>
          <div className="absolute left-3.5 top-3 text-ink/50 pointer-events-none">
            <Clock className="w-4 h-4" />
          </div>
          <ChevronDown className="w-4 h-4 absolute right-3.5 top-3 text-ink/50 pointer-events-none" />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 animate-fade-up" style={{ animationDelay: '100ms' }}>
        <StatCard 
          icon={<ShoppingCart className="w-5 h-5" />} 
          iconBg="bg-[#E7F7ED]" 
          iconColor="text-[#14833D]"
          label="Total Orders" 
          value={stats.totalOrders.total} 
          trend={stats.totalOrders.trend} 
        />
        <StatCard 
          icon={<DollarSign className="w-5 h-5" />} 
          iconBg="bg-blue-50" 
          iconColor="text-blue-600"
          label="Total Commission" 
          value={`$${stats.totalCommission.total.toFixed(2)}`} 
          trend={stats.totalCommission.trend} 
        />
        <StatCard 
          icon={<CheckCircle2 className="w-5 h-5" />} 
          iconBg="bg-[#E7F7ED]" 
          iconColor="text-[#14833D]"
          label="Paid Commission" 
          value={`$${stats.paidCommission.total.toFixed(2)}`} 
          subtitle={`${stats.paidCommission.count} ${stats.paidCommission.count === 1 ? 'order' : 'orders'}`}
        />
      </div>

      {/* Pending Card */}
      <div className="w-full bg-white p-6 rounded-2xl border border-line shadow-sm animate-fade-up" style={{ animationDelay: '150ms' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
            <Clock className="w-5 h-5" />
          </div>
          <span className="text-sm font-semibold text-ink/70">Pending Commission</span>
        </div>
        <div className="font-heading text-3xl font-bold text-ink mb-1">${stats.pendingCommission.total.toFixed(2)}</div>
        <div className="text-xs font-medium text-ink/50">{stats.pendingCommission.count} {stats.pendingCommission.count === 1 ? 'order' : 'orders'}</div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-line overflow-hidden animate-fade-up" style={{ animationDelay: '200ms' }}>
        <div className="p-5 md:p-6 border-b border-line flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="font-heading text-xl font-bold text-ink">All conversions</h2>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-ink/40" />
              <input 
                type="text" 
                placeholder="Search orders..." 
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full bg-page-bg border border-transparent hover:border-line focus:border-primary/30 text-sm font-medium rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition placeholder:text-ink/40"
              />
            </div>
            <div className="relative w-full sm:w-auto">
              <select 
                value={status}
                onChange={(e) => { setStatus(e.target.value); updateFilters({ status: e.target.value, page: 1 }); }}
                className="w-full sm:w-auto appearance-none bg-white border border-line hover:border-ink/20 text-sm font-medium rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition cursor-pointer"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
              </select>
              <div className="absolute left-3.5 top-3 text-ink/50 pointer-events-none">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
              </div>
              <ChevronDown className="w-4 h-4 absolute right-3.5 top-3 text-ink/50 pointer-events-none" />
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-page-bg/30 border-b border-line text-xs font-semibold text-ink/60">
              <tr>
                <th className="px-6 py-4">Order</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Commission</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {initialConversions.length > 0 ? initialConversions.map(c => (
                <tr key={c.id} className="hover:bg-page-bg/30 transition group">
                  <td className="px-6 py-4 font-semibold text-primary hover:underline">
                    <Link href="#" className="flex items-center gap-1.5">
                      {c.shopifyOrderName || `#${c.id.substring(c.id.length - 4)}`}
                      <ExternalLink className="w-3 h-3 text-primary/70" />
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-6 py-4 font-semibold text-ink/90">
                    ${c.commissionAmount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-ink/70 font-medium text-sm">
                    {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Link 
                      href="#" 
                      className="inline-flex flex-row items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs font-medium text-primary hover:bg-primary/5 transition bg-white"
                    >
                      View Order
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-ink/50 font-medium">
                    No conversions found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalFiltered > 0 && (
          <div className="px-6 py-4 border-t border-line flex items-center justify-between bg-page-bg/30">
            <div className="text-sm text-ink/60 font-medium">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalFiltered)} of {totalFiltered} conversions
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
        )}
      </div>

      {/* Tip Banner */}
      <div className="bg-primary-light/10 rounded-2xl border border-primary/20 p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-up" style={{ animationDelay: '300ms' }}>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-ink">Tip</h3>
            <p className="text-sm text-ink/70 font-medium mt-0.5">Share your unique link and discount code to earn more commissions.</p>
          </div>
        </div>
        <button 
          onClick={() => setIsShareModalOpen(true)}
          className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-primary text-white hover:bg-primary-dark text-sm font-semibold rounded-xl transition shadow-sm w-full md:w-auto justify-center"
        >
          Share Your Link
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {isShareModalOpen && (
        <ShareDialog
          title="Share & earn"
          affiliateId={affiliateId}
          referralLink={referralLink}
          discountCode={discountCode}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}
    </div>
  );
}

function StatCard({ icon, iconBg, iconColor, label, value, trend, subtitle }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-line shadow-sm flex flex-col justify-center relative overflow-hidden group">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2.5 rounded-xl ${iconBg} ${iconColor}`}>
          {icon}
        </div>
        <span className="text-sm font-semibold text-ink/70">{label}</span>
      </div>
      <div className="font-heading text-3xl font-bold text-ink mb-1">{value}</div>
      {subtitle ? (
        <div className="text-xs font-medium text-ink/50">{subtitle}</div>
      ) : (
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
      )}
    </div>
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
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${style}`}>
      {icon}
      {status}
    </span>
  );
}
