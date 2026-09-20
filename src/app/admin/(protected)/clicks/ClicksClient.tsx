"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  MousePointerClick, Users, Monitor, ShoppingCart, Search, RefreshCw,
  ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, CheckCircle2, XCircle, AlertTriangle
} from "lucide-react";

export function ClicksClient({
  initialClicks,
  totalFiltered,
  page,
  pageSize,
  stats,
  searchQuery,
  currentAffiliateId,
  currentDevice,
  currentClickType,
  currentDateRange,
  affiliates
}: {
  initialClicks: any[];
  totalFiltered: number;
  page: number;
  pageSize: number;
  stats: any;
  searchQuery: string;
  currentAffiliateId: string;
  currentDevice: string;
  currentClickType: string;
  currentDateRange: string;
  affiliates: any[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchQuery);

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
    
    // Process updates
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        if (updates[key] && updates[key] !== "all" && updates[key] !== 1) {
          params.set(key, updates[key].toString());
        } else {
          params.delete(key);
        }
      }
    });

    router.push(`?${params.toString()}`);
  };

  const resetFilters = () => {
    setQ("");
    router.push("?");
  };

  const totalPages = Math.ceil(totalFiltered / pageSize);

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-ink">Clicks</h1>
          <p className="mt-1.5 text-sm text-ink/60 font-medium">
            Track and analyze referral clicks from your affiliates in real time.
          </p>
        </div>
        
        {/* Top-right Date and Search - replicating mockup exactly */}
        <div className="flex items-center gap-3">
          <div className="relative min-w-[280px] hidden md:block">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-ink/40" />
            <input 
              type="text" 
              placeholder="Search affiliates, emails, or IP addresses..." 
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-page-bg border border-transparent hover:border-line focus:border-primary/30 text-sm rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 transition placeholder:text-ink/40"
            />
          </div>
          <SelectFilter 
            icon={<Monitor className="w-4 h-4" />} // placeholder icon for date
            value={currentDateRange}
            onChange={(val: string) => updateFilters({ dateRange: val, page: 1 })}
            options={[
              { label: "All Time", value: "all" },
              { label: "Last 7 days", value: "last7" },
              { label: "Last 30 days", value: "last30" },
              { label: "This month", value: "thisMonth" }
            ]}
          />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard 
          icon={<MousePointerClick className="w-5 h-5" />} 
          iconBg="bg-blue-50" 
          iconColor="text-blue-600"
          label="Total Clicks" 
          value={stats.totalClicks.total} 
          trend={stats.totalClicks.trend} 
        />
        <StatCard 
          icon={<Users className="w-5 h-5" />} 
          iconBg="bg-green-50" 
          iconColor="text-green-600"
          label="Unique Affiliates" 
          value={stats.uniqueAffiliates.total} 
          trend={stats.uniqueAffiliates.trend} 
        />
        <StatCard 
          icon={<Monitor className="w-5 h-5" />} 
          iconBg="bg-blue-50" 
          iconColor="text-blue-600"
          label="Desktop Clicks" 
          value={stats.desktopClicks.total} 
          trend={stats.desktopClicks.trend} 
        />
        <StatCard 
          icon={<ShoppingCart className="w-5 h-5" />} 
          iconBg="bg-purple-50" 
          iconColor="text-purple-600"
          label="Clicks Converted" 
          value={stats.clicksConverted.total} 
          trend={stats.clicksConverted.trend} 
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white p-2 rounded-2xl shadow-sm border border-line">
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <SelectFilter 
            icon={<Monitor className="w-4 h-4" />} // just using a placeholder icon as Date is above
            value={currentDateRange}
            onChange={(val: string) => updateFilters({ dateRange: val, page: 1 })}
            options={[
              { label: "All Time", value: "all" },
              { label: "Last 7 days", value: "last7" },
              { label: "Last 30 days", value: "last30" },
              { label: "This month", value: "thisMonth" }
            ]}
          />
          <SelectFilter 
            icon={<Users className="w-4 h-4" />}
            value={currentAffiliateId}
            onChange={(val: string) => updateFilters({ affiliateId: val, page: 1 })}
            options={[
              { label: "All Affiliates", value: "all" },
              ...affiliates.map(a => ({ label: a.userEmail, value: a.id }))
            ]}
          />
          <SelectFilter 
            icon={<Monitor className="w-4 h-4" />}
            value={currentDevice}
            onChange={(val: string) => updateFilters({ device: val, page: 1 })}
            options={[
              { label: "All Devices", value: "all" },
              { label: "Desktop", value: "desktop" },
              { label: "Mobile", value: "mobile" }
            ]}
          />
          <SelectFilter 
            icon={<MousePointerClick className="w-4 h-4" />}
            value={currentClickType}
            onChange={(val: string) => updateFilters({ clickType: val, page: 1 })}
            options={[
              { label: "All Clicks", value: "all" },
              { label: "Converted", value: "converted" },
              { label: "Suspicious", value: "suspicious" }
            ]}
          />
        </div>

        <button onClick={resetFilters} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-line rounded-xl hover:bg-page-bg transition shrink-0 w-full lg:w-auto justify-center">
          <RefreshCw className="w-4 h-4 text-ink/60" />
          Reset
        </button>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-line overflow-hidden">
        <div className="p-6 border-b border-line flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="font-heading text-lg font-bold text-ink">Most recent {pageSize} referral clicks</h2>
            <p className="text-sm text-ink/60 font-medium mt-1">Detailed view of the latest clicks on your affiliate links.</p>
          </div>
          
          <div className="relative w-full sm:w-auto min-w-[250px] block md:hidden">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-ink/40" />
            <input 
              type="text" 
              placeholder="Search by affiliate email..." 
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-page-bg border border-transparent hover:border-line focus:border-primary/30 text-sm rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 transition placeholder:text-ink/40"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-page-bg/50 border-b border-line text-xs font-semibold text-ink/60">
              <tr>
                <th className="px-6 py-4 w-12">#</th>
                <th className="px-6 py-4">Affiliate</th>
                <th className="px-6 py-4">Device</th>
                <th className="px-6 py-4">Converted</th>
                <th className="px-6 py-4">Suspicious</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {initialClicks.length > 0 ? initialClicks.map((c, idx) => (
                <ClickRow key={c.id} click={c} index={(page - 1) * pageSize + idx + 1} />
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-ink/50 font-medium">
                    No clicks found matching your criteria.
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
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalFiltered)} of {totalFiltered} clicks
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
        className="appearance-none bg-white border border-line hover:border-ink/20 text-sm font-medium rounded-xl pl-10 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 transition cursor-pointer shadow-sm min-w-[140px]"
      >
        {options.map((o: any) => (
          <option key={o.value} value={o.value} className="capitalize">
            {o.label.length > 25 ? o.label.substring(0, 25) + "..." : o.label}
          </option>
        ))}
      </select>
      <div className="absolute left-3.5 top-2.5 text-ink/50 pointer-events-none">
        {icon}
      </div>
      <ChevronDown className="w-4 h-4 absolute right-3.5 top-2.5 text-ink/50 pointer-events-none" />
    </div>
  );
}

function ClickRow({ click, index }: { click: any, index: number }) {
  // Mockup shows date like: 19/9/2026, 8:23:44 am
  const d = new Date(click.createdAt);
  const formattedDate = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()}`;

  const isDesktop = click.deviceType?.toLowerCase() === 'desktop' || !click.deviceType; // default to desktop for mockup parity if null
  const deviceIcon = isDesktop ? <Monitor className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />; // Replace with mobile icon if needed

  return (
    <tr className="hover:bg-page-bg/30 transition group">
      <td className="px-6 py-4 text-ink/60 font-medium">
        {index}
      </td>
      <td className="px-6 py-4">
        <Link href={`/admin/affiliates/${click.affiliateId}`} className="font-medium text-ink hover:text-primary transition">
          {click.affiliate?.userEmail}
        </Link>
      </td>
      <td className="px-6 py-4">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600">
          {deviceIcon}
          {isDesktop ? "Desktop" : "Mobile"}
        </span>
      </td>
      <td className="px-6 py-4">
        <Pill label={click.convertedToOrder ? "Yes" : "No"} type={click.convertedToOrder ? "success" : "neutral"} />
      </td>
      <td className="px-6 py-4">
        <Pill label={click.isSuspicious ? "Yes" : "No"} type={click.isSuspicious ? "danger" : "success"} />
      </td>
      <td className="px-6 py-4 text-ink/70 font-medium text-sm">
        {formattedDate}
      </td>
      <td className="px-6 py-4 text-center">
        <ActionMenu click={click} />
      </td>
    </tr>
  );
}

function Pill({ label, type }: { label: string, type: 'success' | 'neutral' | 'danger' }) {
  let style = "bg-page-bg text-ink/60";
  if (type === 'success') style = "bg-[#E7F7ED] text-[#14833D]";
  if (type === 'danger') style = "bg-error/10 text-error";
  
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
}

function ActionMenu({ click }: { click: any }) {
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

  const toggleSuspicious = async () => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/clicks/${click.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSuspicious: !click.isSuspicious }),
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
        disabled={isUpdating}
        className="p-1.5 rounded-lg border border-line text-ink/50 hover:text-ink hover:bg-page-bg transition bg-white shadow-sm disabled:opacity-50"
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
              href={`/admin/affiliates/${click.affiliateId}`}
              className="block w-full text-left px-4 py-2 text-sm text-ink/80 hover:bg-page-bg hover:text-primary transition font-medium"
            >
              View Affiliate
            </Link>
            
            <div className="border-t border-line my-1"></div>
            
            <button
              onClick={toggleSuspicious}
              className={`block w-full text-left px-4 py-2 text-sm transition font-medium ${click.isSuspicious ? 'text-green-600 hover:bg-green-50' : 'text-error hover:bg-error/10'}`}
            >
              {click.isSuspicious ? "Mark Not Suspicious" : "Mark Suspicious"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
