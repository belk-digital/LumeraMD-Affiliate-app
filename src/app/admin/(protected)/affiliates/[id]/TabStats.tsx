"use client";

import { useState } from "react";
import { Shield, Calendar, ArrowUp } from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

export function TabStats({ affiliate }: { affiliate: Record<string, any> }) {
  const [timeRange, setTimeRange] = useState<"7" | "30" | "all">("30");

  // Filter logic
  const now = new Date();
  const filterDate = new Date();
  if (timeRange === "7") filterDate.setDate(now.getDate() - 7);
  else if (timeRange === "30") filterDate.setDate(now.getDate() - 30);
  else filterDate.setFullYear(2000); // effectively "all time"

  const filteredClicks = (affiliate.clicks || []).filter((c: any) => new Date(c.createdAt) >= filterDate);
  const filteredConversions = (affiliate.conversions || []).filter((c: any) => new Date(c.createdAt) >= filterDate);

  const totalClicks = filteredClicks.length;
  const totalConversions = filteredConversions.length;
  const totalCommissionEarned = filteredConversions.reduce((sum: number, c: any) => sum + (c.commissionAmount || 0), 0);

  // Calculate stats
  const convRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : "0.0";
  
  // Calculate dynamic data for Clicks & Conversions chart
  const clicksByDate: Record<string, number> = {};
  const conversionsByDate: Record<string, number> = {};

  filteredClicks.forEach((c: any) => {
    const d = new Date(c.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    clicksByDate[d] = (clicksByDate[d] || 0) + 1;
  });
  
  filteredConversions.forEach((c: any) => {
    const d = new Date(c.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    conversionsByDate[d] = (conversionsByDate[d] || 0) + 1;
  });

  const allDates = Array.from(new Set([...Object.keys(clicksByDate), ...Object.keys(conversionsByDate)]));
  // Simple sort by assuming recent year
  allDates.sort((a, b) => new Date(`${a} 2026`).getTime() - new Date(`${b} 2026`).getTime());

  const areaData = allDates.length > 0 ? allDates.map(date => ({
    name: date,
    clicks: clicksByDate[date] || 0,
    conversions: conversionsByDate[date] || 0,
  })) : [];

  // Calculate dynamic data for Traffic Sources
  const sourceCount: Record<string, number> = {};
  let totalSourceClicks = 0;
  filteredClicks.forEach((c: any) => {
    const src = c.source || "Direct";
    sourceCount[src] = (sourceCount[src] || 0) + 1;
    totalSourceClicks++;
  });
  
  const colors = ["#6366f1", "#eab308", "#14b8a6", "#3b82f6", "#f43f5e"];
  const pieData = Object.entries(sourceCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5) // top 5
    .map(([name, count], idx) => ({
      name,
      value: totalSourceClicks > 0 ? Math.round((count / totalSourceClicks) * 100) : 0,
      color: colors[idx % colors.length]
    }));

  return (
    <div className="space-y-6">
      {/* Performance Overview */}
      <div className="rounded-2xl border border-line bg-white shadow-sm flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="bg-primary-light p-2 rounded-lg text-primary">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold text-ink leading-tight">Performance Overview</h2>
              <p className="text-xs text-ink/50">Detailed performance metrics for this affiliate.</p>
            </div>
          </div>
          
          <select 
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as "7" | "30" | "all")}
            className="flex items-center gap-2 px-3 py-1.5 border border-line rounded-lg text-xs font-medium text-ink hover:bg-page-bg transition outline-none cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%2364748B%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_0.5rem_center] pr-8"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="all">All Time</option>
          </select>
        </div>
        
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Clicks */}
          <div className="p-4 border border-line rounded-xl">
            <div className="flex items-center gap-2 mb-2 text-ink/60">
              <span className="text-xs font-medium">Clicks</span>
            </div>
            <div className="font-heading text-xl font-bold text-ink">{totalClicks}</div>
          </div>
          
          {/* Conversions */}
          <div className="p-4 border border-line rounded-xl">
            <div className="flex items-center gap-2 mb-2 text-ink/60">
              <span className="text-xs font-medium">Conversions</span>
            </div>
            <div className="font-heading text-xl font-bold text-ink">{totalConversions}</div>
          </div>
          
          {/* Conversion Rate */}
          <div className="p-4 border border-line rounded-xl">
            <div className="flex items-center gap-2 mb-2 text-ink/60">
              <span className="text-xs font-medium">Conversion Rate</span>
            </div>
            <div className="font-heading text-xl font-bold text-ink">{convRate}%</div>
          </div>
          
          {/* Revenue */}
          <div className="p-4 border border-line rounded-xl">
            <div className="flex items-center gap-2 mb-2 text-ink/60">
              <span className="text-xs font-medium">Revenue</span>
            </div>
            <div className="font-heading text-xl font-bold text-ink">${totalCommissionEarned.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Line Chart */}
        <div className="md:col-span-2 rounded-2xl border border-line bg-white shadow-sm flex flex-col h-[350px]">
          <div className="flex items-center justify-between p-5 border-b border-line">
            <h2 className="font-heading text-base font-semibold text-ink">Clicks & Conversions</h2>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5 text-primary">
                <div className="w-2 h-2 rounded-full bg-primary" /> Clicks
              </div>
              <div className="flex items-center gap-1.5 text-indigo-400">
                <div className="w-2 h-2 rounded-full bg-indigo-400" /> Conversions
              </div>
            </div>
          </div>
          <div className="flex-1 p-5 pt-4">
            {areaData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eaf3" />
                  <XAxis dataKey="name" tick={{fontSize: 10, fill: '#64748b'}} tickLine={false} axisLine={false} />
                  <YAxis tick={{fontSize: 10, fill: '#64748b'}} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '12px' }}
                    labelStyle={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="clicks" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorClicks)" />
                  <Area type="monotone" dataKey="conversions" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorConversions)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-ink/50">
                No data available for the selected period.
              </div>
            )}
          </div>
        </div>
        
        {/* Pie Chart */}
        <div className="md:col-span-1 rounded-2xl border border-line bg-white shadow-sm flex flex-col h-[350px]">
          <div className="p-5 border-b border-line">
            <h2 className="font-heading text-base font-semibold text-ink">Traffic Sources</h2>
          </div>
          <div className="flex-1 p-2 flex items-center justify-center relative">
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="40%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3">
                  {pieData.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[11px] text-ink/70 font-medium w-16 truncate">{item.name}</span>
                      <span className="text-[11px] text-ink/50">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-ink/50 text-center px-4">
                No traffic data yet.
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
