"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  User, 
  Reply, 
  Percent, 
  BarChart, 
  CreditCard, 
  ShieldAlert, 
  Edit2, 
  Copy, 
  Mail, 
  Link as LinkIcon, 
  Ban,
  CheckCircle2
} from "lucide-react";

type Tab = "identity" | "referral" | "commission" | "stats" | "payout" | "fraud";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "identity", label: "Identity", icon: <User className="w-4 h-4" /> },
  { id: "referral", label: "Referral", icon: <Reply className="w-4 h-4" /> },
  { id: "commission", label: "Commission", icon: <Percent className="w-4 h-4" /> },
  { id: "stats", label: "Stats", icon: <BarChart className="w-4 h-4" /> },
  { id: "payout", label: "Payout", icon: <CreditCard className="w-4 h-4" /> },
  { id: "fraud", label: "Fraud & Internal", icon: <ShieldAlert className="w-4 h-4" /> },
];

export function TabsNav({ currentTab }: { currentTab: string }) {
  return (
    <div className="flex border-b border-line overflow-x-auto hide-scrollbar">
      {TABS.map((tab) => {
        const isActive = currentTab === tab.id;
        return (
          <Link
            key={tab.id}
            href={`?tab=${tab.id}`}
            className={`flex items-center gap-2 whitespace-nowrap px-6 py-4 text-sm font-medium border-b-2 transition ${
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-ink/60 hover:text-ink hover:border-line"
            }`}
          >
            {tab.icon}
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export function IdentityInfoCard({ affiliate }: { affiliate: Record<string, any> }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [formData, setFormData] = useState({
    userEmail: affiliate.userEmail || "",
    displayName: affiliate.displayName || "",
    referralSlug: affiliate.referralSlug || "",
    shopifyDiscountCode: affiliate.shopifyDiscountCode || "",
    shopifyDiscountValue: affiliate.shopifyDiscountValue || 10,
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/admin/affiliates/${affiliate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsEditing(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Failed to update identity information.");
      }
    } catch (e) {
      setErrorMsg("Error updating identity information.");
    } finally {
      setIsSaving(false);
    }
  };

  const appBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const referralLink = `${appBaseUrl}/ref/${affiliate.referralSlug}`;

  return (
    <div className="rounded-2xl border border-line bg-white shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between p-6 pb-4 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="bg-primary-light p-2 rounded-lg text-primary">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold text-ink leading-tight">Identity Information</h2>
            <p className="text-xs text-ink/50">Basic details and account information for this affiliate.</p>
          </div>
        </div>
        {isEditing ? (
          <div className="flex gap-2">
            <button 
              onClick={() => {
                setIsEditing(false);
                setErrorMsg("");
                setFormData({
                  userEmail: affiliate.userEmail || "",
                  displayName: affiliate.displayName || "",
                  referralSlug: affiliate.referralSlug || "",
                  shopifyDiscountCode: affiliate.shopifyDiscountCode || "",
                  shopifyDiscountValue: affiliate.shopifyDiscountValue || 10,
                });
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-line rounded-lg text-ink/80 hover:bg-page-bg transition"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-transparent rounded-lg text-white bg-primary hover:bg-primary-dark transition disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-line rounded-lg text-ink/80 hover:bg-page-bg transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
      </div>
      
      {errorMsg && (
        <div className="mx-6 mt-4 p-3 bg-error/10 border border-error/20 text-error text-xs rounded-xl flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="text-error hover:text-error/70">
            <User className="w-3 h-3 hidden" /> &times;
          </button>
        </div>
      )}

      <div className="flex-1 p-6 space-y-5 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-ink/60 w-32 shrink-0">Email</span>
          <div className="flex items-center justify-between flex-1 pl-4">
            {isEditing ? (
              <input 
                type="email" 
                value={formData.userEmail}
                onChange={e => setFormData({...formData, userEmail: e.target.value})}
                className="flex-1 border border-line rounded-md px-2 py-1 text-sm bg-page-bg"
              />
            ) : (
              <>
                <span className="font-medium">{affiliate.userEmail}</span>
                <button onClick={() => handleCopy(affiliate.userEmail)} className="text-ink/40 hover:text-ink transition p-1">
                  <Copy className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-ink/60 w-32 shrink-0">Display Name</span>
          <div className="flex-1 pl-4">
            {isEditing ? (
              <input 
                type="text" 
                value={formData.displayName}
                onChange={e => setFormData({...formData, displayName: e.target.value})}
                className="w-full border border-line rounded-md px-2 py-1 text-sm bg-page-bg"
              />
            ) : (
              <span className="font-medium">{affiliate.displayName || "—"}</span>
            )}
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-ink/60 w-32 shrink-0">Status</span>
          <div className="flex-1 pl-4">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              affiliate.status === 'approved' ? 'bg-green-100 text-green-800' :
              affiliate.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              'bg-error/10 text-error'
            }`}>
              {affiliate.status.charAt(0).toUpperCase() + affiliate.status.slice(1)}
            </span>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-ink/60 w-32 shrink-0">Joined</span>
          <div className="flex-1 pl-4">
            <span className="font-medium">{new Date(affiliate.createdAt).toLocaleDateString('en-GB')}</span>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-ink/60 w-32 shrink-0">Affiliate ID</span>
          <div className="flex items-center justify-between flex-1 pl-4">
            <span className="font-medium font-mono text-xs">{affiliate.id}</span>
            <button onClick={() => handleCopy(affiliate.id)} className="text-ink/40 hover:text-ink transition p-1">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-ink/60 w-32 shrink-0">Referral Code</span>
          <div className="flex items-center justify-between flex-1 pl-4 overflow-hidden">
            {isEditing ? (
              <input 
                type="text" 
                value={formData.referralSlug}
                onChange={e => setFormData({...formData, referralSlug: e.target.value})}
                className="flex-1 border border-line rounded-md px-2 py-1 text-sm bg-page-bg font-mono text-xs text-primary"
              />
            ) : (
              <>
                <span className="font-medium font-mono text-xs truncate text-primary">{affiliate.referralSlug}</span>
                <button onClick={() => handleCopy(affiliate.referralSlug)} className="text-ink/40 hover:text-ink transition p-1 ml-2 shrink-0">
                  <Copy className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-ink/60 w-32 shrink-0">Shopify Code</span>
          <div className="flex items-center justify-between flex-1 pl-4 overflow-hidden">
            {isEditing ? (
              <input 
                type="text" 
                value={formData.shopifyDiscountCode}
                onChange={e => setFormData({...formData, shopifyDiscountCode: e.target.value})}
                className="flex-1 border border-line rounded-md px-2 py-1 text-sm bg-page-bg font-mono text-xs text-primary uppercase"
                placeholder="e.g. SUMMER10"
              />
            ) : (
              <>
                <span className="font-medium font-mono text-xs truncate text-primary uppercase">{affiliate.shopifyDiscountCode || "—"}</span>
                {affiliate.shopifyDiscountCode && (
                  <button onClick={() => handleCopy(affiliate.shopifyDiscountCode)} className="text-ink/40 hover:text-ink transition p-1 ml-2 shrink-0">
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-ink/60 w-32 shrink-0">Discount Amount (%)</span>
          <div className="flex-1 pl-4">
            {isEditing ? (
              <input 
                type="number" 
                min="0"
                max="100"
                value={formData.shopifyDiscountValue}
                onChange={e => setFormData({...formData, shopifyDiscountValue: parseFloat(e.target.value) || 0})}
                className="w-24 border border-line rounded-md px-2 py-1 text-sm bg-page-bg"
              />
            ) : (
              <span className="font-medium">{affiliate.shopifyDiscountValue}%</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AccountStatusCard({ affiliate }: { affiliate: Record<string, any> }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const isSuspended = affiliate.status === "suspended";

  async function handleToggleSuspend() {
    setIsSubmitting(true);
    setErrorMsg("");
    const newStatus = isSuspended ? "approved" : "suspended";
    
    // In a real app we might prompt for a reason in a modal here
    try {
      const res = await fetch(`/api/admin/affiliates/${affiliate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          suspendReason: isSuspended ? null : "Suspended by admin via Quick Actions",
        }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Failed to update status.");
      }
    } catch (e) {
      setErrorMsg("Error updating status.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white shadow-sm flex flex-col">
      <div className="flex items-center gap-3 p-5 border-b border-line">
        <div className="bg-primary-light p-2 rounded-lg text-primary">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-heading text-base font-semibold text-ink leading-tight">Account Status</h2>
          <p className="text-xs text-ink/50">Suspend or unsuspend this affiliate.</p>
        </div>
      </div>
      
      {errorMsg && (
        <div className="mx-5 mt-4 p-3 bg-error/10 border border-error/20 text-error text-xs rounded-xl flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="text-error hover:text-error/70">
            &times;
          </button>
        </div>
      )}

      <div className="p-5 space-y-4">
        {!isSuspended ? (
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-900">Approved</p>
              <p className="text-xs text-green-700 mt-1">This affiliate can currently access their account and earn commissions.</p>
            </div>
          </div>
        ) : (
          <div className="bg-error/10 border border-error/20 rounded-xl p-4 flex gap-3">
            <Ban className="w-5 h-5 text-error shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-error">Suspended</p>
              <p className="text-xs text-error/80 mt-1">
                {affiliate.suspendReason || "This affiliate is suspended and cannot earn commissions."}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleToggleSuspend}
          disabled={isSubmitting}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition disabled:opacity-50 ${
            isSuspended 
              ? "bg-primary text-white hover:bg-primary-dark border-transparent" 
              : "bg-error/5 text-error border-error/20 hover:bg-error/10"
          }`}
        >
          <Ban className="w-4 h-4" />
          {isSubmitting ? "Updating..." : isSuspended ? "Unsuspend Affiliate" : "Suspend Affiliate"}
        </button>
      </div>
    </div>
  );
}

export function QuickActionsCard({ affiliate }: { affiliate: Record<string, any> }) {
  const handleCopyLink = () => {
    const appBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    navigator.clipboard.writeText(`${appBaseUrl}/ref/${affiliate.referralSlug}`);
  };

  return (
    <div className="rounded-2xl border border-line bg-white shadow-sm flex flex-col">
      <div className="flex items-center gap-3 p-5 border-b border-line">
        <div className="bg-primary-light p-2 rounded-lg text-primary">
          <ZapIcon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-heading text-base font-semibold text-ink leading-tight">Quick Actions</h2>
          <p className="text-xs text-ink/50">Common actions for this affiliate.</p>
        </div>
      </div>
      
      <div className="p-5 grid grid-cols-2 gap-3">
        <a href={`mailto:${affiliate.userEmail}`} className="flex items-center justify-center gap-2 px-3 py-2.5 border border-line rounded-xl text-xs font-medium hover:bg-page-bg transition">
          <Mail className="w-4 h-4 text-ink/60" />
          Send Email
        </a>
        <button onClick={handleCopyLink} className="flex items-center justify-center gap-2 px-3 py-2.5 border border-line rounded-xl text-xs font-medium hover:bg-page-bg transition">
          <LinkIcon className="w-4 h-4 text-ink/60" />
          Copy Referral Link
        </button>
        <Link href={`?tab=stats`} className="flex items-center justify-center gap-2 px-3 py-2.5 border border-line rounded-xl text-xs font-medium hover:bg-page-bg transition">
          <BarChart className="w-4 h-4 text-ink/60" />
          View Statistics
        </Link>
        <Link href={`?tab=payout`} className="flex items-center justify-center gap-2 px-3 py-2.5 border border-line rounded-xl text-xs font-medium hover:bg-page-bg transition">
          <CreditCard className="w-4 h-4 text-ink/60" />
          View Payouts
        </Link>
      </div>
    </div>
  );
}

// A simple Zap icon that Lucide provides but sometimes is called Zap
function ZapIcon(props: Record<string, any>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}


