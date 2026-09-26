"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { 
  DollarSign, Clock, CheckCircle2, Search, ChevronDown, 
  ChevronLeft, ChevronRight, Info, Mail, Gift, ArrowRight, Wallet
} from "lucide-react";
import { formatMoney } from "@/lib/format";
import { fmtDate } from "../ui";
import StatusPill from "@/components/StatusPill";
import PayoutForm from "../PayoutForm";

export function PayoutsClient({
  affiliate,
  payouts,
  stats,
  available,
}: {
  affiliate: any;
  payouts: any[];
  stats: any;
  available: number;
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const filteredPayouts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return payouts.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      const payoutId = `PAY-${new Date(p.createdAt).getFullYear()}-${p.id.substring(p.id.length - 4)}`;
      const period = new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" });
      return (
        payoutId.toLowerCase().includes(q) ||
        formatMoney(p.amount).toLowerCase().includes(q) ||
        period.toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q)
      );
    });
  }, [payouts, statusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredPayouts.length / itemsPerPage));
  const paginatedPayouts = filteredPayouts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const startItem = filteredPayouts.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, filteredPayouts.length);

  const savedDestination =
    affiliate.payoutDetails &&
    typeof affiliate.payoutDetails === "object" &&
    "destination" in affiliate.payoutDetails
      ? String((affiliate.payoutDetails as any).destination ?? "")
      : "";

  return (
    <div className="space-y-6 md:space-y-8 p-4 md:p-8 max-w-7xl mx-auto w-full">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-up">
        <div>
          <h1 className="font-heading text-3xl font-bold text-ink">Payouts</h1>
          <p className="mt-1.5 text-sm text-ink/60 font-medium">
            Track your earnings, view payout history, and manage your payment details.
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 animate-fade-up" style={{ animationDelay: '100ms' }}>
        <div className="bg-white p-6 rounded-2xl border border-line shadow-sm flex flex-col justify-center relative overflow-hidden">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-[#E7F7ED] text-[#14833D]">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-sm font-semibold text-ink/70">Total Earned</span>
          </div>
          <div className="font-heading text-3xl font-bold text-ink mb-1">{formatMoney(stats.totalEarned)}</div>
          <div className={`flex items-center gap-1.5 text-xs font-medium ${stats.totalEarnedTrend < 0 ? "text-error" : "text-green-600"}`}>
            {stats.totalEarnedTrend < 0 ? `↓ ${Math.abs(stats.totalEarnedTrend)}%` : `↑ ${stats.totalEarnedTrend}%`}
            <span className="text-ink/40 font-normal">vs. previous 30 days</span>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-line shadow-sm flex flex-col justify-center relative overflow-hidden">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-sm font-semibold text-ink/70">Pending</span>
          </div>
          <div className="font-heading text-3xl font-bold text-ink mb-1">{formatMoney(stats.pending.amount)}</div>
          <div className="text-xs font-medium text-ink/50">{stats.pending.count} {stats.pending.count === 1 ? 'order' : 'orders'}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-line shadow-sm flex flex-col justify-center relative overflow-hidden">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-[#E7F7ED] text-[#14833D]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-sm font-semibold text-ink/70">Paid</span>
          </div>
          <div className="font-heading text-3xl font-bold text-ink mb-1">{formatMoney(stats.paid.amount)}</div>
          <div className="text-xs font-medium text-ink/50">{stats.paid.count} {stats.paid.count === 1 ? 'order' : 'orders'}</div>
        </div>
      </div>

      {/* Payout Method Card */}
      <div className="bg-white rounded-2xl border border-line p-6 shadow-sm flex items-center justify-between gap-4 animate-fade-up" style={{ animationDelay: '150ms' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl">
            {affiliate.payoutMethod === 'paypal' ? 'P' : affiliate.payoutMethod === 'cashapp' ? '$' : 'Z'}
          </div>
          <div>
            <h3 className="font-heading font-bold text-ink capitalize">{affiliate.payoutMethod || 'No Method Set'}</h3>
            <p className="text-sm text-ink/60">{savedDestination || 'Please configure a payout destination'}</p>
          </div>
        </div>
        <button 
          onClick={() => setIsEditModalOpen(true)}
          className="px-4 py-2 border border-line rounded-lg text-sm font-medium hover:bg-page-bg transition"
        >
          Edit
        </button>
      </div>

      {/* Payout History Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-line overflow-hidden animate-fade-up" style={{ animationDelay: '200ms' }}>
        <div className="p-5 md:p-6 border-b border-line flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="font-heading text-xl font-bold text-ink">Payout History</h2>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-ink/40 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search payouts..."
                className="w-full bg-white border border-line hover:border-ink/20 text-sm font-medium rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
            <div className="relative w-40 shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full appearance-none bg-white border border-line hover:border-ink/20 text-sm font-medium rounded-xl pl-4 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 transition cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3.5 top-2.5 text-ink/50 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-page-bg/30 border-b border-line text-xs font-semibold text-ink/60">
              <tr>
                <th className="px-6 py-4">Payout ID</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Period</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {paginatedPayouts.length > 0 ? paginatedPayouts.map(p => (
                <tr key={p.id} className="hover:bg-page-bg/30 transition">
                  <td className="px-6 py-4 font-semibold text-ink/80">
                    PAY-{new Date(p.createdAt).getFullYear()}-{p.id.substring(p.id.length - 4)}
                  </td>
                  <td className="px-6 py-4 font-semibold text-ink/90">
                    {formatMoney(p.amount)}
                  </td>
                  <td className="px-6 py-4 text-ink/70 text-sm">
                    {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4">
                    <StatusPill status={p.status} />
                  </td>
                  <td className="px-6 py-4 text-ink/70 font-medium text-sm">
                    {fmtDate(p.createdAt)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-ink/50 font-medium">
                    No payouts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {filteredPayouts.length > 0 && (
          <div className="px-6 py-4 border-t border-line flex items-center justify-between bg-page-bg/30">
            <div className="text-sm text-ink/60 font-medium">
              Showing {startItem} to {endItem} of {filteredPayouts.length}
            </div>
            <div className="flex items-center gap-1">
              <button 
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="p-1.5 rounded-lg border border-line text-ink/60 hover:text-ink hover:bg-white disabled:opacity-50 transition bg-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center px-2">
                <span className="w-8 h-8 flex items-center justify-center bg-primary text-white font-medium rounded-lg text-sm">
                  {currentPage}
                </span>
              </div>
              <button 
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-1.5 rounded-lg border border-line text-ink/60 hover:text-ink hover:bg-white disabled:opacity-50 transition bg-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payout Schedule Banner */}
      <div className="bg-blue-50/50 rounded-2xl border border-blue-100 p-5 flex items-start gap-4 animate-fade-up" style={{ animationDelay: '250ms' }}>
        <div className="p-2 bg-blue-100 rounded-full text-blue-600 shrink-0 mt-0.5">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-heading font-bold text-ink">Payout Schedule</h3>
          <p className="text-sm text-ink/70 font-medium mt-1 leading-relaxed">
            Payouts are processed monthly. Pending commissions become eligible after the return window (e.g., 30 days).
          </p>
        </div>
      </div>

      {/* Payment Information */}
      <div className="bg-white rounded-2xl border border-line p-6 shadow-sm animate-fade-up" style={{ animationDelay: '300ms' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-heading text-lg font-bold text-ink">Payment Information</h2>
          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="px-4 py-2 border border-line rounded-lg text-sm font-medium hover:bg-page-bg transition"
          >
            Edit
          </button>
        </div>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2">
            <span className="text-ink/60 font-medium flex items-center gap-2"><Wallet className="w-4 h-4"/> Payment Method</span>
            <span className="text-ink font-medium capitalize">{affiliate.payoutMethod || '—'}</span>
          </div>
          <div className="grid grid-cols-2">
            <span className="text-ink/60 font-medium flex items-center gap-2"><Mail className="w-4 h-4"/> Destination</span>
            <span className="text-ink font-medium">{savedDestination || '—'}</span>
          </div>
          <div className="grid grid-cols-2">
            <span className="text-ink/60 font-medium flex items-center gap-2"><DollarSign className="w-4 h-4"/> Minimum Payout</span>
            <span className="text-ink font-medium">{formatMoney(affiliate.minimumPayoutThreshold)}</span>
          </div>
          <div className="grid grid-cols-2">
            <span className="text-ink/60 font-medium flex items-center gap-2"><Clock className="w-4 h-4"/> Next Payout Date</span>
            <span className="text-ink font-medium">First of next month</span>
          </div>
        </div>
      </div>

      {/* Earn More Tip */}
      <div className="bg-primary-light/10 rounded-2xl border border-primary/20 p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-up" style={{ animationDelay: '350ms' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-ink text-lg">Earn More</h3>
            <p className="text-sm text-ink/70 font-medium">Refer. Share. Grow.</p>
          </div>
        </div>
        <Link 
          href={`../team`}
          className="shrink-0 flex items-center gap-2 px-6 py-3 bg-primary text-white hover:bg-primary-dark text-sm font-bold rounded-xl transition shadow-sm w-full md:w-auto justify-center"
        >
          Share Your Link
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Support Banner */}
      <div className="bg-page-bg rounded-2xl border border-line p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-up" style={{ animationDelay: '400ms' }}>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-white border border-line text-ink flex items-center justify-center shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-ink">Need help with payouts?</h3>
            <p className="text-sm text-ink/70 font-medium mt-0.5">Contact our support team if you have any questions about your earnings.</p>
          </div>
        </div>
        <a 
          href="mailto:main.belkdigital@gmail.com" 
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-white border border-line text-ink hover:bg-page-bg hover:border-ink/20 text-sm font-semibold rounded-xl transition shadow-sm w-full md:w-auto justify-center"
        >
          <Mail className="w-4 h-4" />
          Contact Support
        </a>
      </div>

      {/* Request/Edit Payout Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl animate-fade-up relative">
            <button 
              onClick={() => setIsEditModalOpen(false)} 
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-ink/50 hover:bg-page-bg hover:text-ink transition"
            >
              ✕
            </button>
            <h2 className="font-heading text-xl font-bold mb-2">Request Payout</h2>
            <p className="text-sm text-ink/60 mb-6">Manage your payout method and request withdrawals.</p>
            
            <PayoutForm 
              available={available}
              minimumThreshold={affiliate.minimumPayoutThreshold}
              defaultMethod={affiliate.payoutMethod ?? undefined}
              defaultDestination={savedDestination}
            />
          </div>
        </div>
      )}

    </div>
  );
}
