"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  ShoppingCart, DollarSign, MousePointerClick, Percent, Download,
  ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Users, Calendar
} from "lucide-react";
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import Avatar from "@/components/Avatar";

export function ReportsClient({
  dailyData,
  stats,
  currentDateRange,
  currentAffiliateId,
  affiliates
}: {
  dailyData: any[];
  stats: any;
  currentDateRange: string;
  currentAffiliateId: string;
  affiliates: any[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Local state for pagination and sorting
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [sortBy, setSortBy] = useState("dateDesc");

  const updateFilters = (updates: any) => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        if (updates[key] && updates[key] !== "all") {
          params.set(key, updates[key].toString());
        } else {
          params.delete(key);
        }
      }
    });

    setPage(1); // Reset page on filter change
    router.push(`?${params.toString()}`);
  };

  const resetFilters = () => {
    setPage(1);
    setSortBy("dateDesc");
    router.push("?");
  };

  const handleExport = () => {
    const headers = ["Date", "Orders", "Revenue", "Commission", "Clicks", "Conversions", "Top Affiliate Email"];
    const rows = dailyData.map(d => [
      d.dateStr,
      d.orders,
      d.revenue.toFixed(2),
      d.commission.toFixed(2),
      d.clicks,
      d.conversions,
      d.topAffiliate?.email || "None"
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reports_export_${currentDateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sort data for the table
  const tableData = useMemo(() => {
    const data = [...dailyData];
    if (sortBy === "dateDesc") {
      data.sort((a, b) => new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime());
    } else if (sortBy === "revenueDesc") {
      data.sort((a, b) => b.revenue - a.revenue);
    } else if (sortBy === "ordersDesc") {
      data.sort((a, b) => b.orders - a.orders);
    } else if (sortBy === "clicksDesc") {
      data.sort((a, b) => b.clicks - a.clicks);
    }
    return data;
  }, [dailyData, sortBy]);

  const totalFiltered = tableData.length;
  const totalPages = Math.ceil(totalFiltered / pageSize);
  const paginatedData = tableData.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-ink">Reports</h1>
          <p className="mt-1.5 text-sm text-ink/60 font-medium">
            Analyze affiliate performance, sales, clicks, and commissions.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <SelectFilter 
            icon={<Calendar className="w-4 h-4" />}
            value={currentDateRange}
            onChange={(val: string) => updateFilters({ dateRange: val })}
            options={[
              { label: "Last 7 days", value: "last7" },
              { label: "Last 30 days", value: "last30" },
              { label: "This month", value: "thisMonth" },
              { label: "All Time", value: "all" }
            ]}
          />
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-medium text-sm transition shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard 
          icon={<ShoppingCart className="w-5 h-5" />} 
          iconBg="bg-blue-50" 
          iconColor="text-blue-600"
          label="Total Orders" 
          value={stats.totalOrders.total} 
          trend={stats.totalOrders.trend} 
        />
        <StatCard 
          icon={<DollarSign className="w-5 h-5" />} 
          iconBg="bg-green-50" 
          iconColor="text-green-600"
          label="Total Revenue" 
          value={`$${stats.totalRevenue.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} 
          trend={stats.totalRevenue.trend} 
        />
        <StatCard 
          icon={<Percent className="w-5 h-5" />} 
          iconBg="bg-purple-50" 
          iconColor="text-purple-600"
          label="Total Commission" 
          value={`$${stats.totalCommission.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} 
          trend={stats.totalCommission.trend} 
        />
        <StatCard 
          icon={<MousePointerClick className="w-5 h-5" />} 
          iconBg="bg-orange-50" 
          iconColor="text-orange-600"
          label="Total Clicks" 
          value={stats.totalClicks.total} 
          trend={stats.totalClicks.trend} 
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue & Commission Bar Chart */}
        <div className="bg-white p-6 rounded-2xl border border-line shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-lg font-bold text-ink">Revenue & Commission</h2>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]"></div>Revenue</span>
              <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#6366f1]"></div>Commission</span>
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="shortDate" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `$${val}`} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, '']}
                />
                <Bar dataKey="revenue" name="Revenue" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="commission" name="Commission" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Clicks & Conversions Line Chart */}
        <div className="bg-white p-6 rounded-2xl border border-line shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-lg font-bold text-ink">Clicks vs Conversions</h2>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#14b8a6]"></div>Clicks</span>
              <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]"></div>Conversions</span>
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="shortDate" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="clicks" name="Clicks" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3, fill: '#14b8a6' }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="conversions" name="Conversions" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white p-2 rounded-2xl shadow-sm border border-line">
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <SelectFilter 
            icon={<Calendar className="w-4 h-4" />}
            value={currentDateRange}
            onChange={(val: string) => updateFilters({ dateRange: val })}
            options={[
              { label: "Last 7 days", value: "last7" },
              { label: "Last 30 days", value: "last30" },
              { label: "This month", value: "thisMonth" },
              { label: "All Time", value: "all" }
            ]}
          />
          <SelectFilter 
            icon={<Users className="w-4 h-4" />}
            value={currentAffiliateId}
            onChange={(val: string) => updateFilters({ affiliateId: val })}
            options={[
              { label: "All Affiliates", value: "all" },
              ...affiliates.map(a => ({ label: a.userEmail, value: a.id }))
            ]}
          />
          <SelectFilter 
            icon={<RefreshCw className="w-4 h-4" />}
            value={sortBy}
            onChange={(val: string) => setSortBy(val)}
            options={[
              { label: "Sort: Date (Newest)", value: "dateDesc" },
              { label: "Sort: Highest Revenue", value: "revenueDesc" },
              { label: "Sort: Most Orders", value: "ordersDesc" },
              { label: "Sort: Most Clicks", value: "clicksDesc" }
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-page-bg/50 border-b border-line text-xs font-semibold text-ink/60">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Orders</th>
                <th className="px-6 py-4">Revenue</th>
                <th className="px-6 py-4">Commission</th>
                <th className="px-6 py-4">Clicks</th>
                <th className="px-6 py-4">Conversions</th>
                <th className="px-6 py-4">Top Affiliate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {paginatedData.length > 0 ? paginatedData.map((d, idx) => (
                <tr key={idx} className="hover:bg-page-bg/30 transition group">
                  <td className="px-6 py-4 font-medium text-ink">
                    {d.displayDate}
                  </td>
                  <td className="px-6 py-4 font-semibold text-ink/80">
                    {d.orders}
                  </td>
                  <td className="px-6 py-4 font-semibold text-ink/90">
                    ${d.revenue.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 font-semibold text-ink/90">
                    ${d.commission.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-ink/80 font-medium">
                    {d.clicks}
                  </td>
                  <td className="px-6 py-4 text-ink/80 font-medium">
                    {d.conversions}
                  </td>
                  <td className="px-6 py-4">
                    {d.topAffiliate ? (
                      <Link href={`/admin/affiliates/${d.topAffiliate.id}`} className="flex items-center gap-2 group-hover:text-primary transition">
                        <Avatar name={d.topAffiliate.name} size="sm" />
                        <span className="font-semibold text-ink/80 group-hover:text-primary transition">{d.topAffiliate.name}</span>
                      </Link>
                    ) : (
                      <span className="text-ink/40 font-medium">—</span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-ink/50 font-medium">
                    No data found for the selected period.
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
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalFiltered)} of {totalFiltered} days
            </div>
            <div className="flex items-center gap-1">
              <button 
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
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
                onClick={() => setPage(page + 1)}
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
        <span className="text-ink/40">vs. previous period</span>
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
        className="appearance-none bg-white border border-line hover:border-ink/20 text-sm font-medium rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition cursor-pointer shadow-sm min-w-[150px]"
      >
        {options.map((o: any) => (
          <option key={o.value} value={o.value} className="capitalize">
            {o.label.length > 25 ? o.label.substring(0, 25) + "..." : o.label}
          </option>
        ))}
      </select>
      <div className="absolute left-3.5 top-3 text-ink/50 pointer-events-none">
        {icon}
      </div>
      <ChevronDown className="w-4 h-4 absolute right-3.5 top-3 text-ink/50 pointer-events-none" />
    </div>
  );
}
