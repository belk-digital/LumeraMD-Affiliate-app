"use client";

import { useState, useMemo } from "react";
import { 
  Users, ShoppingCart, DollarSign, Share2, 
  Search, Copy, Check, ChevronLeft, ChevronRight, 
  MoreHorizontal, Mail, UserPlus, ArrowUp
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import Avatar from "@/components/Avatar";
import StatusPill from "@/components/StatusPill";
import { formatMoney } from "@/lib/format";
import { fmtDate } from "../ui";
import Link from "next/link";
import { ShareDialog } from "../ShareButton";

export default function TeamClient({ 
  affiliateId,
  members, 
  kpis, 
  inviteLink 
}: { 
  affiliateId: string;
  members: any[]; 
  kpis: any; 
  inviteLink: string; 
}) {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  const [viewingMember, setViewingMember] = useState<any | null>(null);
  const itemsPerPage = 5;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMoreShare = async () => {
    const shareData = { title: "Join my affiliate team", text: "Join my affiliate team on LumeraMD", url: inviteLink };
    if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch {
        // cancelled — nothing to do
      }
    } else {
      handleCopy();
    }
  };

  // Process data for Team Growth Chart
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    // Initialize last 30 days with 0
    for(let i=0; i<=30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      counts[dateStr] = 0;
    }

    // Add member join dates
    members.forEach(m => {
      const joinDate = new Date(m.createdAt);
      if (joinDate >= thirtyDaysAgo) {
        const dateStr = joinDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (counts[dateStr] !== undefined) {
          counts[dateStr]++;
        }
      }
    });

    // Cumulative sum
    let total = 0;
    return Object.entries(counts).map(([name, count]) => {
      total += count;
      return { name, members: total };
    });
  }, [members]);

  // Filter and Paginate Table
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const searchMatch = 
        (m.displayName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.userEmail || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      const statusMatch = statusFilter === "all" || m.status.toLowerCase() === statusFilter.toLowerCase();
      
      return searchMatch && statusMatch;
    });
  }, [members, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / itemsPerPage));
  const paginatedMembers = filteredMembers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const startItem = filteredMembers.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, filteredMembers.length);

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="animate-fade-up">
          <h1 className="font-heading text-3xl font-bold text-ink">My Team</h1>
          <p className="mt-1 text-sm text-ink/60">
            Manage your sub-affiliates and track their performance.
          </p>
        </div>
        <button 
          onClick={() => setInviteModalOpen(true)} 
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark transition shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Invite Sub-Affiliate
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-up" style={{ "--delay": "100ms" } as React.CSSProperties}>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-ink/70 font-medium mb-4">
            <div className="bg-primary-light text-primary p-2 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-sm">Total Team Members</span>
          </div>
          <div className="font-heading text-3xl font-bold text-ink">{kpis.members.value}</div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-ink/50">
            <span className="flex items-center text-green-600 font-medium"><ArrowUp className="w-3 h-3 mr-0.5" />{kpis.members.change}%</span>
            vs. previous 30 days
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-ink/70 font-medium mb-4">
            <div className="bg-primary-light text-primary p-2 rounded-lg">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <span className="text-sm">Team Orders</span>
          </div>
          <div className="font-heading text-3xl font-bold text-ink">{kpis.conversions.value}</div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-ink/50">
            <span className="flex items-center text-green-600 font-medium"><ArrowUp className="w-3 h-3 mr-0.5" />{kpis.conversions.change}%</span>
            vs. previous 30 days
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-ink/70 font-medium mb-4">
            <div className="bg-primary-light text-primary p-2 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
            <span className="text-sm">Team Commission</span>
          </div>
          <div className="font-heading text-3xl font-bold text-ink">{formatMoney(kpis.earnings.value)}</div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-ink/50">
            <span className="flex items-center text-green-600 font-medium"><ArrowUp className="w-3 h-3 mr-0.5" />{kpis.earnings.change}%</span>
            vs. previous 30 days
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-ink/70 font-medium mb-4">
            <div className="bg-primary-light text-primary p-2 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-sm">Level 1 Members</span>
          </div>
          <div className="font-heading text-3xl font-bold text-ink">{members.length}</div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-ink/50">
            <span className="flex items-center text-green-600 font-medium"><ArrowUp className="w-3 h-3 mr-0.5" />{kpis.secondLevel.change}%</span>
            vs. previous 30 days
          </div>
        </div>
      </div>

      {/* Middle Section: Chart & Invite */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-up" style={{ "--delay": "150ms" } as React.CSSProperties}>
        {/* Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-line bg-white p-6 shadow-sm flex flex-col h-[350px]">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="font-heading text-lg font-bold text-ink">Team Growth</h2>
              <p className="text-xs text-ink/60 mt-0.5">New team members over time.</p>
            </div>
            <select className="border border-line rounded-lg text-xs font-medium px-3 py-1.5 text-ink/70 bg-page-bg outline-none appearance-none cursor-pointer pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%2364748B%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_0.5rem_center]">
              <option>Last 30 days</option>
            </select>
          </div>
          <div className="flex-1 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eaf3" />
                <XAxis 
                  dataKey="name" 
                  tick={{fontSize: 10, fill: '#64748b'}} 
                  tickLine={false} 
                  axisLine={false} 
                  minTickGap={30}
                />
                <YAxis 
                  tick={{fontSize: 10, fill: '#64748b'}} 
                  tickLine={false} 
                  axisLine={false} 
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '12px' }}
                  labelStyle={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="members" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorMembers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Invite Widget */}
        <div className="lg:col-span-1 rounded-2xl border border-line bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold text-ink">Invite New Affiliate</h2>
            <p className="text-xs text-ink/60 mt-1 mb-6">
              Share your invitation link to bring new affiliates into your team.
            </p>
            
            <div className="flex items-center gap-2 mb-8">
              <div className="flex-1 bg-page-bg border border-line rounded-xl px-3 py-2.5 text-xs text-ink/70 truncate overflow-hidden">
                {inviteLink}
              </div>
              <button 
                onClick={handleCopy}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-medium text-white hover:bg-primary-dark transition shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copy
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center pb-2">
            <SocialBtn icon={<Mail className="w-4 h-4 text-white" />} color="bg-blue-400" label="Email" href={`mailto:?subject=Join my affiliate team&body=Hey, I'd love to invite you to join my affiliate team. Sign up here: ${inviteLink}`} />
            <SocialBtn icon={<div className="font-bold text-white text-[15px]">W</div>} color="bg-green-500" label="WhatsApp" href={`https://wa.me/?text=${encodeURIComponent('Join my affiliate team: ' + inviteLink)}`} />
            <SocialBtn 
              icon={<svg className="w-4 h-4 fill-white" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>} 
              color="bg-black" label="X / Twitter" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Join my affiliate team: ' + inviteLink)}`} 
            />
            <SocialBtn 
              icon={<svg className="w-4 h-4 fill-white" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>} 
              color="bg-blue-600" label="Facebook" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteLink)}`} 
            />
            <SocialBtn 
              icon={<svg className="w-4 h-4 fill-white" viewBox="0 0 24 24"><path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z"/></svg>} 
              color="bg-blue-700" label="LinkedIn" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(inviteLink)}`} 
            />
            <button onClick={handleMoreShare} className="flex flex-col items-center gap-2 group">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-page-bg border border-line group-hover:-translate-y-1 transition transform duration-200 shadow-sm hover:shadow-md">
                <MoreHorizontal className="w-4 h-4 text-ink" />
              </div>
              <span className="text-[10px] text-ink/60 font-medium">More</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="rounded-2xl border border-line bg-white p-6 shadow-sm animate-fade-up" style={{ "--delay": "200ms" } as React.CSSProperties}>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="font-heading text-lg font-bold text-ink">My Team Members</h2>
            <p className="text-xs text-ink/60 mt-1">A list of affiliates who joined under you.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-ink/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search team members..." 
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-9 pr-4 py-2 bg-page-bg border border-line rounded-lg text-sm w-[220px] focus:outline-none focus:border-primary transition"
              />
            </div>
            <select 
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="px-4 py-2 pr-8 bg-page-bg border border-line rounded-lg text-sm focus:outline-none appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%2364748B%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_0.5rem_center]"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm text-left">
            <thead className="bg-page-bg/50 border-y border-line text-xs font-medium text-ink/60">
              <tr>
                <th className="px-4 py-3.5 rounded-tl-xl font-medium">Name</th>
                <th className="px-4 py-3.5 font-medium">Email</th>
                <th className="px-4 py-3.5 font-medium">Status</th>
                <th className="px-4 py-3.5 font-medium">Joined</th>
                <th className="px-4 py-3.5 font-medium">Orders</th>
                <th className="px-4 py-3.5 font-medium">Commission</th>
                <th className="px-4 py-3.5 rounded-tr-xl font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {paginatedMembers.map(m => (
                <tr key={m.id} className="hover:bg-page-bg/30 transition group">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center text-xs font-bold font-heading">
                        {(m.displayName || m.userEmail).substring(0,2).toUpperCase()}
                      </div>
                      <span className="font-medium text-ink truncate max-w-[150px]">{m.displayName || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-ink/70 truncate max-w-[180px]">{m.userEmail}</td>
                  <td className="px-4 py-3.5"><StatusPill status={m.status} /></td>
                  <td className="px-4 py-3.5 text-ink/70 whitespace-nowrap">{fmtDate(m.createdAt)}</td>
                  <td className="px-4 py-3.5 text-ink/70">{m.totalConversions}</td>
                  <td className="px-4 py-3.5 text-ink/70 font-medium">{formatMoney(m.earnedFromThem)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewingMember(m)}
                        className="text-primary hover:text-primary-dark font-medium text-[11px] px-3 py-1.5 border border-primary/20 rounded-lg hover:bg-primary-light transition"
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedMembers.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink/50 text-sm">
                    No team members found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredMembers.length > 0 && (
          <div className="flex items-center justify-between mt-6 text-sm text-ink/60 border-t border-line pt-6">
            <div>
              Showing {startItem} to {endItem} of {filteredMembers.length} team members
            </div>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-line bg-white text-ink/60 hover:text-ink hover:bg-page-bg disabled:opacity-50 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              {Array.from({length: totalPages}, (_, i) => i + 1).map(page => (
                <button 
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition ${
                    currentPage === page ? "bg-primary text-white" : "border border-transparent hover:border-line hover:bg-page-bg text-ink/70"
                  }`}
                >
                  {page}
                </button>
              ))}

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-line bg-white text-ink/60 hover:text-ink hover:bg-page-bg disabled:opacity-50 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {isInviteModalOpen && (
        <ShareDialog
          title="Invite Sub-Affiliate"
          defaultMessage={`Join my affiliate team on LumeraMD: ${inviteLink}`}
          affiliateId={affiliateId}
          referralLink={inviteLink}
          discountCode={null}
          qrType="invite"
          onClose={() => setInviteModalOpen(false)}
        />
      )}

      {viewingMember && (
        <MemberDetailsModal member={viewingMember} onClose={() => setViewingMember(null)} />
      )}
    </div>
  );
}

function MemberDetailsModal({ member, onClose }: { member: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-line flex items-center justify-between bg-page-bg/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center text-sm font-bold font-heading">
              {(member.displayName || member.userEmail).substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="font-heading text-base font-bold text-ink">{member.displayName || "—"}</h2>
              <p className="text-xs text-ink/60">{member.userEmail}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink/40 hover:text-ink transition text-xl leading-none">&times;</button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-ink/60">Status</span>
            <StatusPill status={member.status} />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ink/60">Joined</span>
            <span className="font-medium text-ink">{fmtDate(member.createdAt)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ink/60">Their Total Orders</span>
            <span className="font-medium text-ink">{member.totalConversions ?? 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ink/60">Their Total Commission</span>
            <span className="font-medium text-ink">{formatMoney(member.totalCommissionEarned ?? 0)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-line/50">
            <span className="text-ink/60">Earned From Them (Override)</span>
            <span className="font-bold text-ink">{formatMoney(member.earnedFromThem ?? 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SocialBtn({ icon, color, label, href }: { icon: React.ReactNode, color: string, label: string, href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 group">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color} group-hover:-translate-y-1 transition transform duration-200 shadow-sm hover:shadow-md`}>
        {icon}
      </div>
      <span className="text-[10px] text-ink/60 font-medium">{label}</span>
    </a>
  );
}
