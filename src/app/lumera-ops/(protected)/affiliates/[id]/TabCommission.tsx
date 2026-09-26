"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Percent, CheckCircle2, Clock, Check, Edit2, X } from "lucide-react";
import { pctChange } from "@/lib/metrics";

export function TabCommission({ affiliate }: { affiliate: Record<string, any> }) {
  const router = useRouter();
  
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    commissionRate: affiliate.commissionRate,
    parentOverrideRate: affiliate.parentOverrideRate !== null ? affiliate.parentOverrideRate : "",
    cookieDurationDays: affiliate.cookieDurationDays,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/lumera-ops/affiliates/${affiliate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsEditing(null);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Failed to update settings.");
      }
    } catch (e) {
      setErrorMsg("Error updating settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(null);
    setErrorMsg("");
    setFormData({
      commissionRate: affiliate.commissionRate,
      parentOverrideRate: affiliate.parentOverrideRate !== null ? affiliate.parentOverrideRate : "",
      cookieDurationDays: affiliate.cookieDurationDays,
    });
  };

  // Calculate Average Order Value
  const totalOrderSubtotal = affiliate.conversions?.reduce((acc: number, conv: Record<string, any>) => acc + conv.orderSubtotal, 0) || 0;
  const numOrders = affiliate.conversions?.length || 0;
  const aov = numOrders > 0 ? totalOrderSubtotal / numOrders : 0;

  // Commission trend: last 30 days vs the 30 days before that, from this affiliate's own conversions.
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const commissionCur = (affiliate.conversions || []).reduce((acc: number, c: Record<string, any>) => {
    const age = now - new Date(c.createdAt).getTime();
    return age >= 0 && age < thirtyDaysMs ? acc + c.commissionAmount : acc;
  }, 0);
  const commissionPrev = (affiliate.conversions || []).reduce((acc: number, c: Record<string, any>) => {
    const age = now - new Date(c.createdAt).getTime();
    return age >= thirtyDaysMs && age < thirtyDaysMs * 2 ? acc + c.commissionAmount : acc;
  }, 0);
  const commissionTrend = Math.round(pctChange(commissionCur, commissionPrev));

  const displayHistory = affiliate.conversions && affiliate.conversions.length > 0
    ? affiliate.conversions.map((c: Record<string, any>) => ({
        date: new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        order: `#${c.shopifyOrderName || c.shopifyOrderId.substring(0, 6)}`,
        value: `$${c.orderSubtotal.toFixed(2)}`,
        commission: `$${c.commissionAmount.toFixed(2)}`,
        status: c.status.charAt(0).toUpperCase() + c.status.slice(1)
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Top 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Commission Summary */}
        <div className="rounded-2xl border border-line bg-white shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-3 p-5 border-b border-line">
            <div className="bg-primary-light p-2 rounded-lg text-primary">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold text-ink leading-tight">Commission Summary</h2>
              <p className="text-xs text-ink/50">Overview of this affiliate&apos;s earnings and commission structure.</p>
            </div>
          </div>
          
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between p-4 bg-page-bg rounded-xl border border-line">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <div className="text-xs text-ink/60 font-medium">Total Commission</div>
                  <div className="font-heading text-xl font-bold text-ink mt-0.5">${affiliate.totalCommissionEarned.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                </div>
              </div>
              <div className={`flex items-center text-sm font-medium ${commissionTrend < 0 ? "text-error" : "text-green-600"}`}>
                {commissionTrend < 0 ? <>&darr; {Math.abs(commissionTrend)}%</> : <>&uarr; {commissionTrend}%</>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border border-line rounded-xl">
                <div className="flex items-center gap-2 mb-2 text-ink/60">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-medium">Pending Commission</span>
                </div>
                <div className="font-heading text-lg font-bold text-ink">${affiliate.totalCommissionPending.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
              </div>
              
              <div className="p-4 border border-line rounded-xl">
                <div className="flex items-center gap-2 mb-2 text-ink/60">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium">Paid Commission</span>
                </div>
                <div className="font-heading text-lg font-bold text-ink">${affiliate.totalCommissionPaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-line text-sm">
              <span className="text-ink/60">Commission Rate</span>
              <span className="font-bold text-ink">{affiliate.commissionRate}%</span>
            </div>
            <div className="flex justify-between items-center pb-2 text-sm">
              <span className="text-ink/60">Average Order Value</span>
              <span className="font-bold text-ink">${aov.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Commission Rate */}
        <div className="rounded-2xl border border-line bg-white shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-3 p-5 border-b border-line">
            <div className="bg-primary-light p-2 rounded-lg text-primary">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold text-ink leading-tight">Commission Rate</h2>
              <p className="text-xs text-ink/50">Current commission settings for this affiliate.</p>
            </div>
          </div>
          
          {errorMsg && (
            <div className="mx-5 mt-4 p-3 bg-error/10 border border-error/20 text-error text-xs rounded-xl">
              {errorMsg}
            </div>
          )}
          
          <div className="p-5 space-y-6 text-sm flex-1">
            <div className="flex justify-between items-center pb-4 border-b border-line/50">
              <span className="text-ink/60">Standard Rate</span>
              <div className="flex items-center gap-4">
                {isEditing === "standard" ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      className="border border-line rounded px-2 py-1 w-20 bg-page-bg text-right"
                      value={formData.commissionRate}
                      onChange={e => setFormData({ ...formData, commissionRate: Number(e.target.value) })}
                    />
                    <span>%</span>
                    <button onClick={handleSave} disabled={isSaving} className="text-primary hover:text-primary-dark ml-2 font-medium">Save</button>
                    <button onClick={handleCancel} className="text-ink/50 hover:text-ink"><X className="w-4 h-4"/></button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium text-ink">{affiliate.commissionRate}%</span>
                    <button onClick={() => setIsEditing("standard")} className="flex items-center gap-1.5 px-3 py-1.5 border border-line rounded-lg hover:bg-page-bg transition">
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pb-4 border-b border-line/50">
              <span className="text-ink/60">Custom Rate</span>
              <div className="flex items-center gap-4">
                {isEditing === "custom" ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      placeholder="Default"
                      className="border border-line rounded px-2 py-1 w-20 bg-page-bg text-right"
                      value={formData.parentOverrideRate}
                      onChange={e => setFormData({ ...formData, parentOverrideRate: e.target.value })}
                    />
                    <span>%</span>
                    <button onClick={handleSave} disabled={isSaving} className="text-primary hover:text-primary-dark ml-2 font-medium">Save</button>
                    <button onClick={handleCancel} className="text-ink/50 hover:text-ink"><X className="w-4 h-4"/></button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium text-ink">{affiliate.parentOverrideRate !== null ? `${affiliate.parentOverrideRate}%` : "—"}</span>
                    <button onClick={() => setIsEditing("custom")} className="flex items-center gap-1.5 px-3 py-1.5 border border-line rounded-lg hover:bg-page-bg transition">
                      <Edit2 className="w-3.5 h-3.5" /> Set
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pb-4 border-b border-line/50">
              <span className="text-ink/60">Cookie Duration</span>
              <div className="flex items-center gap-4">
                {isEditing === "cookie" ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      className="border border-line rounded px-2 py-1 w-20 bg-page-bg text-right"
                      value={formData.cookieDurationDays}
                      onChange={e => setFormData({ ...formData, cookieDurationDays: Number(e.target.value) })}
                    />
                    <span>days</span>
                    <button onClick={handleSave} disabled={isSaving} className="text-primary hover:text-primary-dark ml-2 font-medium">Save</button>
                    <button onClick={handleCancel} className="text-ink/50 hover:text-ink"><X className="w-4 h-4"/></button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium text-ink">{affiliate.cookieDurationDays} days</span>
                    <button onClick={() => setIsEditing("cookie")} className="flex items-center gap-1.5 px-3 py-1.5 border border-line rounded-lg hover:bg-page-bg transition">
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-ink/60">Total Orders</span>
              <div className="flex items-center gap-4">
                <span className="font-bold text-ink">{numOrders} Orders</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Commission History */}
      <div className="rounded-2xl border border-line bg-white shadow-sm flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-line">
          <h2 className="font-heading text-base font-semibold text-ink leading-tight">Commission History</h2>
        </div>

        <div className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-page-bg border-b border-line text-ink/60">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Order #</th>
                <th className="px-5 py-3 font-medium">Order Value</th>
                <th className="px-5 py-3 font-medium">Commission</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {displayHistory.length > 0 ? (
                displayHistory.map((item: Record<string, any>, idx: number) => (
                  <tr key={idx} className="hover:bg-page-bg/50 transition">
                    <td className="px-5 py-3 text-ink/80">{item.date}</td>
                    <td className="px-5 py-3 text-ink/80 font-medium">{item.order}</td>
                    <td className="px-5 py-3 text-ink/80">{item.value}</td>
                    <td className="px-5 py-3 text-ink font-medium">{item.commission}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${
                        item.status === 'Paid' ? 'bg-green-100 text-green-700' :
                        item.status === 'Pending' ? 'bg-orange-100 text-orange-700' :
                        'bg-line text-ink/60'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-ink/50 text-xs">
                    No commissions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
