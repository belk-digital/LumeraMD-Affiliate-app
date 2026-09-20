"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Users, CheckCircle2, Clock, Ban, Search, Download, Plus, 
  ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal 
} from "lucide-react";
import Avatar from "@/components/Avatar";

export function AffiliatesClient({
  initialAffiliates,
  totalFiltered,
  page,
  pageSize,
  stats,
  searchQuery,
  currentStatus,
  currentParent
}: {
  initialAffiliates: any[];
  totalFiltered: number;
  page: number;
  pageSize: number;
  stats: any;
  searchQuery: string;
  currentStatus: string;
  currentParent: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchQuery);
  const [status, setStatus] = useState(currentStatus);
  const [parent, setParent] = useState(currentParent);
  const [showAddModal, setShowAddModal] = useState(false);

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
    if (updates.parent !== undefined) {
      if (updates.parent && updates.parent !== "all") params.set("parent", updates.parent);
      else params.delete("parent");
    }
    if (updates.page !== undefined) {
      if (updates.page > 1) params.set("page", updates.page.toString());
      else params.delete("page");
    }
    router.push(`?${params.toString()}`);
  };

  const handleExport = () => {
    // Basic CSV Export implementation
    const headers = ["ID", "Email", "Name", "Code", "Status", "Joined"];
    const rows = initialAffiliates.map(a => [
      a.id,
      a.userEmail,
      a.displayName || "",
      a.shopifyDiscountCode || "",
      a.status,
      new Date(a.createdAt).toISOString()
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "affiliates_export.csv");
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
          <h1 className="font-heading text-3xl font-bold text-ink">All Affiliates</h1>
          <p className="mt-1.5 text-sm text-ink/60 font-medium">
            Manage and view all affiliates in your program. 
            <span className="mx-2 text-line-dark">|</span> 
            {stats.total.total} total affiliates
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-medium text-sm transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Affiliate
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard 
          icon={<Users className="w-5 h-5" />} 
          iconBg="bg-primary-light" 
          iconColor="text-primary"
          label="Total Affiliates" 
          value={stats.total.total} 
          trend={stats.total.trend} 
        />
        <StatCard 
          icon={<CheckCircle2 className="w-5 h-5" />} 
          iconBg="bg-green-100" 
          iconColor="text-green-600"
          label="Approved" 
          value={stats.approved.total} 
          trend={stats.approved.trend} 
        />
        <StatCard 
          icon={<Clock className="w-5 h-5" />} 
          iconBg="bg-blue-100" 
          iconColor="text-blue-600"
          label="Pending" 
          value={stats.pending.total} 
          trend={stats.pending.trend} 
        />
        <StatCard 
          icon={<Ban className="w-5 h-5" />} 
          iconBg="bg-error/10" 
          iconColor="text-error"
          label="Suspended" 
          value={stats.suspended.total} 
          trend={stats.suspended.trend} 
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white p-2 rounded-2xl shadow-sm border border-line">
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="relative">
            <select 
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                updateFilters({ status: e.target.value, page: 1 });
              }}
              className="appearance-none bg-page-bg border border-transparent hover:border-line text-sm font-medium rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
            <Clock className="w-4 h-4 absolute left-3.5 top-3 text-ink/50 pointer-events-none" />
            <ChevronDown className="w-4 h-4 absolute right-3.5 top-3 text-ink/50 pointer-events-none" />
          </div>

          <div className="relative">
            <select 
              value={parent}
              onChange={(e) => {
                setParent(e.target.value);
                updateFilters({ parent: e.target.value, page: 1 });
              }}
              className="appearance-none bg-page-bg border border-transparent hover:border-line text-sm font-medium rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition cursor-pointer"
            >
              <option value="all">All Parents</option>
              {/* Note: Populating parents dynamically would require another fetch, omitting for brevity */}
            </select>
            <Users className="w-4 h-4 absolute left-3.5 top-3 text-ink/50 pointer-events-none" />
            <ChevronDown className="w-4 h-4 absolute right-3.5 top-3 text-ink/50 pointer-events-none" />
          </div>

          <div className="relative flex-1 min-w-[250px]">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-ink/40" />
            <input 
              type="text" 
              placeholder="Search affiliates by name, email, or code..." 
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

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-page-bg/50 border-b border-line text-xs font-semibold text-ink/60">
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <input type="checkbox" className="rounded border-line text-primary focus:ring-primary/20 cursor-pointer" />
                </th>
                <th className="px-6 py-4">Affiliate</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Conversions</th>
                <th className="px-6 py-4">Earned</th>
                <th className="px-6 py-4">Parent</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {initialAffiliates.length > 0 ? initialAffiliates.map(a => (
                <tr key={a.id} className="hover:bg-page-bg/30 transition group">
                  <td className="px-6 py-4 text-center">
                    <input type="checkbox" className="rounded border-line text-primary focus:ring-primary/20 cursor-pointer" />
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/admin/affiliates/${a.id}`} className="flex items-center gap-3">
                      <Avatar name={a.displayName || a.userEmail} size="md" />
                      <div>
                        <div className="font-semibold text-ink group-hover:text-primary transition">{a.displayName || a.userEmail}</div>
                        {a.displayName && <div className="text-xs text-ink/50 font-medium mt-0.5">{a.userEmail}</div>}
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-6 py-4 font-mono text-xs font-medium text-ink/70 uppercase">
                    {a.shopifyDiscountCode || a.referralSlug || '—'}
                  </td>
                  <td className="px-6 py-4 font-medium text-ink/80">{a.totalConversions}</td>
                  <td className="px-6 py-4 font-medium text-ink/80">${a.totalCommissionEarned.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="px-6 py-4">
                    {a.parentAffiliateId ? (
                      <Link href={`/admin/affiliates/${a.parentAffiliateId}`} className="text-primary hover:underline font-medium text-xs">
                        view
                      </Link>
                    ) : (
                      <span className="text-ink/30 font-medium">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-ink/70 font-medium text-sm">
                    {new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <ActionMenu affiliate={a} />
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-ink/50 font-medium">
                    No affiliates found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-6 py-4 border-t border-line flex items-center justify-between bg-page-bg/30">
          <div className="text-sm text-ink/60 font-medium">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalFiltered)} of {totalFiltered} affiliates
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

      {showAddModal && (
        <AddAffiliateModal onClose={() => setShowAddModal(false)} />
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

function StatusBadge({ status }: { status: string }) {
  const isApproved = status === 'approved';
  const isPending = status === 'pending';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
      isApproved ? 'bg-[#E7F7ED] text-[#14833D]' :
      isPending ? 'bg-blue-50 text-blue-700' :
      'bg-error/10 text-error'
    }`}>
      {status}
    </span>
  );
}

function AddAffiliateModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    status: "approved"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch("/api/admin/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create affiliate");
      }
      
      router.refresh();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-line flex items-center justify-between bg-page-bg/50">
          <h2 className="font-heading text-lg font-bold text-ink">Add New Affiliate</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink transition">
            <Ban className="w-5 h-5 rotate-45" /> {/* simple cross icon substitute */}
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-error/10 text-error text-sm rounded-xl font-medium border border-error/20">
              {error}
            </div>
          )}
          
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink/80 block">Display Name</label>
            <input 
              required
              type="text" 
              placeholder="e.g. Kyle Belk"
              value={form.displayName}
              onChange={e => setForm({...form, displayName: e.target.value})}
              className="w-full bg-white border border-line focus:border-primary/50 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-primary/10 transition"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink/80 block">Email Address</label>
            <input 
              required
              type="email" 
              placeholder="trainwithbelk@gmail.com"
              value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
              className="w-full bg-white border border-line focus:border-primary/50 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-primary/10 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink/80 block">Initial Status</label>
            <select 
              value={form.status}
              onChange={e => setForm({...form, status: e.target.value})}
              className="w-full bg-white border border-line focus:border-primary/50 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-primary/10 transition appearance-none"
            >
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
            </select>
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
              {loading ? "Creating..." : "Create Affiliate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ActionMenu({ affiliate }: { affiliate: any }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  // Close when clicking outside or scrolling
  useEffect(() => {
    if (!isOpen) return;
    const close = () => setIsOpen(false);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true); // true for capture phase to catch table scrolls
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

  const toggleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsUpdating(true);
    
    const newStatus = affiliate.status === "suspended" ? "approved" : "suspended";
    try {
      const res = await fetch(`/api/admin/affiliates/${affiliate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          suspendReason: affiliate.status === "suspended" ? null : "Suspended via Quick Actions",
        }),
      });
      if (res.ok) {
        router.refresh();
      }
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
        className="p-1.5 rounded-lg border border-line text-ink/50 hover:text-ink hover:bg-page-bg transition"
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
              href={`/admin/affiliates/${affiliate.id}`}
              className="block px-4 py-2 text-sm text-ink/80 hover:bg-page-bg hover:text-primary transition text-left"
            >
              View Profile
            </Link>
            <Link 
              href={`/admin/affiliates/${affiliate.id}?tab=stats`}
              className="block px-4 py-2 text-sm text-ink/80 hover:bg-page-bg hover:text-primary transition text-left"
            >
              View Performance
            </Link>
            <div className="border-t border-line my-1"></div>
            <button
              onClick={toggleStatus}
              disabled={isUpdating}
              className={`block w-full text-left px-4 py-2 text-sm font-medium transition ${
                affiliate.status === "suspended" 
                  ? "text-green-600 hover:bg-green-50" 
                  : "text-error hover:bg-error/10"
              }`}
            >
              {isUpdating ? "Updating..." : affiliate.status === "suspended" ? "Unsuspend Affiliate" : "Suspend Affiliate"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
