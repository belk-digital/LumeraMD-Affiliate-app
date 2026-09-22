"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, AlertCircle, DollarSign, Plus, Edit2, Settings, Ban } from "lucide-react";

export function TabPayout({ affiliate }: { affiliate: Record<string, any> }) {
  const router = useRouter();
  const [showManualModal, setShowManualModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

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
          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-dark transition shadow-sm"
          >
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
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-line rounded-lg text-xs font-medium hover:bg-page-bg transition"
          >
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
            <span className="font-medium flex-1 pl-4 text-ink">
              ${affiliate.minimumPayoutThreshold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ink/60 w-48 shrink-0">Payout Schedule</span>
            <span className="font-medium flex-1 pl-4 text-ink">Monthly</span>
          </div>
        </div>
      </div>

      {showManualModal && (
        <ManualPayoutModal affiliate={affiliate} onClose={() => setShowManualModal(false)} />
      )}

      {showSettingsModal && (
        <PayoutSettingsModal affiliate={affiliate} onClose={() => setShowSettingsModal(false)} />
      )}
    </div>
  );
}

function ManualPayoutModal({ affiliate, onClose }: { affiliate: Record<string, any>; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    amount: "",
    payoutMethod: "Manual",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/payouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, affiliateId: affiliate.id }),
      });
      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to create manual payout.");
      }
    } catch (e) {
      setError("Failed to create manual payout.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !loading && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-line flex items-center justify-between bg-page-bg/50">
          <h2 className="font-heading text-lg font-bold text-ink">Manual Payout</h2>
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
              onChange={e => setForm({ ...form, amount: e.target.value })}
              className="w-full bg-white border border-line focus:border-primary/50 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-primary/10 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink/80 block">Payment Method</label>
            <input
              type="text"
              value={form.payoutMethod}
              onChange={e => setForm({ ...form, payoutMethod: e.target.value })}
              placeholder="e.g. PayPal, Cash, Bonus"
              className="w-full bg-white border border-line focus:border-primary/50 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-primary/10 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink/80 block">Internal Notes (Optional)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-white border border-line focus:border-primary/50 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-primary/10 transition resize-none h-20"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-line text-ink/70 hover:bg-page-bg transition">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark transition disabled:opacity-50">
              {loading ? "Creating..." : "Create Payout"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PayoutSettingsModal({ affiliate, onClose }: { affiliate: Record<string, any>; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    payoutMethod: affiliate.payoutMethod || "",
    minimumPayoutThreshold: affiliate.minimumPayoutThreshold,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/affiliates/${affiliate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to update payout settings.");
      }
    } catch (e) {
      setError("Failed to update payout settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !loading && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-line flex items-center justify-between bg-page-bg/50">
          <h2 className="font-heading text-lg font-bold text-ink">Payout Settings</h2>
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
            <label className="text-sm font-semibold text-ink/80 block">Payout Method</label>
            <select
              value={form.payoutMethod}
              onChange={e => setForm({ ...form, payoutMethod: e.target.value })}
              className="w-full bg-white border border-line focus:border-primary/50 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-primary/10 transition appearance-none"
            >
              <option value="">Not Set</option>
              <option value="paypal">PayPal</option>
              <option value="bank">Bank Transfer</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink/80 block">Minimum Payout Amount ($)</label>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={form.minimumPayoutThreshold}
              onChange={e => setForm({ ...form, minimumPayoutThreshold: e.target.value })}
              className="w-full bg-white border border-line focus:border-primary/50 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-primary/10 transition"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-line text-ink/70 hover:bg-page-bg transition">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark transition disabled:opacity-50">
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
