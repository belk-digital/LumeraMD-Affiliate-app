"use client";

import { CheckCircle2, Clock, AlertCircle, DollarSign, Plus, Edit2, Settings } from "lucide-react";

export function TabPayout({ affiliate }: { affiliate: Record<string, any> }) {
  // Calculate top metrics
  const paid = affiliate.totalCommissionPaid;
  const pending = affiliate.totalCommissionPending;
  const onHold = 0; // Schema doesn't have onHold, default to 0
  const totalEarned = affiliate.totalCommissionEarned;

  const displayPayouts = affiliate.payouts && affiliate.payouts.length > 0
    ? affiliate.payouts.map((p: Record<string, any>) => ({
        date: new Date(p.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        amount: `$${p.amount.toFixed(2)}`,
        method: p.payoutMethod || "Unknown",
        ref: p.id.substring(0, 16),
        status: p.status.charAt(0).toUpperCase() + p.status.slice(1),
        notes: "-"
      }))
    : [];

  const payoutMethodStr = affiliate.payoutMethod === "paypal" && affiliate.payoutDetails?.destination 
    ? `PayPal (${affiliate.payoutDetails.destination})` 
    : affiliate.payoutMethod === "bank" 
    ? "Bank Transfer"
    : "Not Set";

  return (
    <div className="space-y-6">
      {/* Top Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 border border-line rounded-2xl bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-ink/60">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-xs font-medium">Paid to date</span>
          </div>
          <div className="font-heading text-xl font-bold text-ink">${paid.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div>
        </div>
        
        <div className="p-4 border border-line rounded-2xl bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-ink/60">
            <Clock className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-medium">Pending payout</span>
          </div>
          <div className="font-heading text-xl font-bold text-ink">${pending.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div>
        </div>

        <div className="p-4 border border-line rounded-2xl bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-ink/60">
            <AlertCircle className="w-4 h-4 text-error" />
            <span className="text-xs font-medium">On hold</span>
          </div>
          <div className="font-heading text-xl font-bold text-ink">${onHold}</div>
        </div>

        <div className="p-4 border border-line rounded-2xl bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-ink/60">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium">Total earned</span>
          </div>
          <div className="font-heading text-xl font-bold text-ink">${totalEarned.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div>
        </div>
      </div>

      {/* Payout History */}
      <div className="rounded-2xl border border-line bg-white shadow-sm flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-line">
          <h2 className="font-heading text-base font-semibold text-ink leading-tight">Payout History</h2>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-dark transition shadow-sm">
            <Plus className="w-3.5 h-3.5" />
            Manual Payout
          </button>
        </div>
        
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-page-bg border-b border-line text-ink/60">
              <tr>
                <th className="px-5 py-3 font-medium">Payout Date</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Method</th>
                <th className="px-5 py-3 font-medium">Reference ID</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {displayPayouts.length > 0 ? (
                displayPayouts.map((item: Record<string, any>, idx: number) => (
                  <tr key={idx} className="hover:bg-page-bg/50 transition">
                    <td className="px-5 py-3 text-ink/80">{item.date}</td>
                    <td className="px-5 py-3 text-ink font-medium">{item.amount}</td>
                    <td className="px-5 py-3 text-ink/80">{item.method}</td>
                    <td className="px-5 py-3 text-ink/80 font-mono text-[10px] uppercase">{item.ref}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${
                        item.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-line text-ink/60'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink/50">{item.notes}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-ink/50 text-xs">
                    No payouts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payout Settings */}
      <div className="rounded-2xl border border-line bg-white shadow-sm flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="bg-primary-light p-2 rounded-lg text-primary">
              <Settings className="w-5 h-5" />
            </div>
            <h2 className="font-heading text-base font-semibold text-ink leading-tight">Payout Settings</h2>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-line rounded-lg text-xs font-medium hover:bg-page-bg transition">
            <Edit2 className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>
        
        <div className="p-6 space-y-5 text-sm">
          <div className="flex justify-between items-center pb-4 border-b border-line/50">
            <span className="text-ink/60 w-48 shrink-0">Payout Method</span>
            <span className="font-medium flex-1 pl-4 text-ink">{payoutMethodStr}</span>
          </div>
          <div className="flex justify-between items-center pb-4 border-b border-line/50">
            <span className="text-ink/60 w-48 shrink-0">Minimum Payout Amount</span>
            <span className="font-medium flex-1 pl-4 text-ink">$50.00</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ink/60 w-48 shrink-0">Payout Schedule</span>
            <span className="font-medium flex-1 pl-4 text-ink">Monthly (1st and 15th)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
