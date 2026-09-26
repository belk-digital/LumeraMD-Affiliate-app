"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, CheckCircle2, MoreHorizontal, Ban, Globe } from "lucide-react";
import { AccountStatusCard } from "./AdminAffiliateTabs";

export function TabFraud({ affiliate }: { affiliate: Record<string, any> }) {
  const router = useRouter();
  const [newNote, setNewNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [openNoteMenu, setOpenNoteMenu] = useState<number | null>(null);
  const [showIpHistory, setShowIpHistory] = useState(false);

  // Parse fraud notes
  const notesString = affiliate.fraudNotes || "";
  let parsedNotes: { date: string; author: string; content: string }[] = [];

  try {
    if (notesString.includes("|||")) {
      parsedNotes = notesString.split("|||").filter(Boolean).map((n: string) => JSON.parse(n));
      parsedNotes.reverse(); // newest first
    } else if (notesString.trim()) {
      // Legacy simple string note
      parsedNotes = [{
        date: new Date(affiliate.updatedAt).toLocaleString(),
        author: "Admin",
        content: notesString
      }];
    }
  } catch {
    // Fallback if parsing fails
    if (notesString.trim()) {
      parsedNotes = [{
        date: new Date().toLocaleString(),
        author: "System",
        content: notesString
      }];
    }
  }

  async function saveNotes(notes: { date: string; author: string; content: string }[]) {
    // parsedNotes is newest-first for display; storage is oldest-first.
    const newNotesString = notes.slice().reverse().map((n) => JSON.stringify(n)).join("|||");
    const res = await fetch(`/api/lumera-ops/affiliates/${affiliate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fraudNotes: newNotesString || null }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      alert("Failed to update notes.");
    }
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setIsSaving(true);

    const noteObj = {
      date: new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      author: "Admin", // Would be actual user name in real app
      content: newNote.trim()
    };

    const newNotesString = (affiliate.fraudNotes ? affiliate.fraudNotes + "|||" : "") + JSON.stringify(noteObj);

    const res = await fetch(`/api/lumera-ops/affiliates/${affiliate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fraudNotes: newNotesString }),
    });

    if (res.ok) {
      setNewNote("");
      router.refresh();
    } else {
      alert("Failed to add note.");
    }
    setIsSaving(false);
  }

  async function handleDeleteNote(idx: number) {
    setOpenNoteMenu(null);
    const remaining = parsedNotes.filter((_, i) => i !== idx);
    await saveNotes(remaining);
  }

  // Dynamic risk calculation
  let calculatedScore = affiliate.fraudScore || 0;
  const riskIndicators = [
    { label: "Valid email format", active: true },
    { label: "Normal conversion rate", active: true },
    { label: "No self-referrals detected", active: true },
    { label: "No suspicious clicks", active: true },
    { label: "Clean payment history", active: true },
  ];

  // 1. Check email format
  if (!affiliate.userEmail || !affiliate.userEmail.includes('@')) {
    calculatedScore += 20;
    riskIndicators[0].active = false;
  }

  // 2. High Conversion Rate (e.g. > 25% with > 10 clicks)
  const totalClicks = affiliate.clicks?.length || 0;
  const totalConversions = affiliate.conversions?.length || 0;
  if (totalClicks > 10) {
    const convRate = totalConversions / totalClicks;
    if (convRate > 0.25) {
      calculatedScore += 30;
      riskIndicators[1].active = false;
    }
  }

  // 3. Self Referrals Detected
  const hasSelfReferrals = affiliate.conversions?.some((c: any) => c.selfReferralDetected || c.ipMatchesAffiliate);
  if (hasSelfReferrals) {
    calculatedScore += 40;
    riskIndicators[2].active = false;
  }

  // 4. Suspicious Clicks
  const suspiciousClicksCount = affiliate.clicks?.filter((c: any) => c.isSuspicious)?.length || 0;
  if (suspiciousClicksCount > 0) {
    calculatedScore += Math.min(30, suspiciousClicksCount * 5);
    riskIndicators[3].active = false;
  }

  // 5. Reversed or Voided Conversions
  const reversedConversions = affiliate.conversions?.filter((c: any) => c.status === 'reversed' || c.status === 'voided')?.length || 0;
  if (reversedConversions > 0) {
    calculatedScore += Math.min(40, reversedConversions * 10);
    riskIndicators[4].active = false;
  }

  calculatedScore = Math.min(100, calculatedScore);
  const isLowRisk = calculatedScore < 30;
  const isHighRisk = calculatedScore >= 70;

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
      
      {/* Left Column */}
      <div className="md:col-span-3 space-y-6 h-full">
        <div className="rounded-2xl border border-line bg-white shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-3 p-6 border-b border-line">
            <div className="bg-primary-light p-2 rounded-lg text-primary">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-semibold text-ink leading-tight">Risk Assessment</h2>
              <p className="text-xs text-ink/50">Automated and manual risk indicators for this affiliate.</p>
            </div>
          </div>
          
          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className={`p-3 rounded-full ${isLowRisk ? 'bg-green-100 text-green-600' : isHighRisk ? 'bg-error/10 text-error' : 'bg-orange-100 text-orange-600'}`}>
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div>
                <div className={`font-heading text-xl font-bold ${isLowRisk ? 'text-green-700' : isHighRisk ? 'text-error' : 'text-orange-700'}`}>
                  {isLowRisk ? 'Low Risk' : isHighRisk ? 'High Risk' : 'Medium Risk'}
                </div>
                <div className="text-xs text-ink/50 mt-0.5">
                  {isLowRisk ? 'No significant risk factors detected.' : 'Some suspicious activities detected.'}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-8">
              <div className="h-2 w-full bg-line rounded-full overflow-hidden flex">
                <div className={`h-full ${isLowRisk ? 'bg-green-500' : isHighRisk ? 'bg-error' : 'bg-orange-500'}`} style={{ width: `${calculatedScore || 5}%` }}></div>
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-ink/40 font-medium uppercase tracking-wider">
                <span>Low</span>
                <span>Medium</span>
                <span>High</span>
              </div>
            </div>

            <h3 className="font-heading text-sm font-semibold text-ink mb-4">Risk Indicators</h3>
            <div className="space-y-3">
              {riskIndicators.map((indicator, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${indicator.active ? 'text-green-500' : 'text-line/80'}`} />
                  <span className={`text-sm ${indicator.active ? 'text-ink/80' : 'text-ink/40 line-through decoration-ink/20'}`}>
                    {indicator.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div className="md:col-span-2 space-y-6">
        
        {/* Internal Notes */}
        <div className="rounded-2xl border border-line bg-white shadow-sm flex flex-col">
          <div className="p-5 border-b border-line">
            <h2 className="font-heading text-base font-semibold text-ink leading-tight">Internal Notes</h2>
            <p className="text-xs text-ink/50 mt-0.5">Add internal notes about this affiliate (not visible to them).</p>
          </div>
          
          <div className="p-5 flex flex-col gap-4 border-b border-line/50">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note..."
              className="w-full rounded-xl border border-line bg-page-bg/50 px-4 py-3 text-sm text-ink outline-none transition focus:border-primary focus:bg-white resize-none min-h-[100px]"
            />
            <div className="flex justify-end">
              <button
                onClick={handleAddNote}
                disabled={isSaving || !newNote.trim()}
                className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-primary-dark transition disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Add Note"}
              </button>
            </div>
          </div>

          <div className="p-5">
            <h3 className="font-heading text-sm font-semibold text-ink mb-4">Previous Notes</h3>
            <div className="space-y-5">
              {parsedNotes.length > 0 ? (
                parsedNotes.map((note, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center font-heading text-xs font-bold shrink-0 mt-1">
                      {note.author.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-bold text-ink">{note.author}</div>
                          <div className="text-[10px] text-ink/40">{note.date}</div>
                        </div>
                        <div className="relative">
                          <button
                            onClick={() => setOpenNoteMenu(openNoteMenu === idx ? null : idx)}
                            className="text-ink/30 hover:text-ink/60 transition p-1"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {openNoteMenu === idx && (
                            <div className="absolute right-0 top-7 z-10 w-32 rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 border border-line overflow-hidden">
                              <button
                                onClick={() => handleDeleteNote(idx)}
                                className="block w-full text-left px-3 py-2 text-xs text-error hover:bg-error/10 transition font-medium"
                              >
                                Delete note
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-ink/80 leading-relaxed bg-page-bg/50 p-3 rounded-xl rounded-tl-none border border-line/50">
                        {note.content}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-xs text-ink/50">
                  No previous notes found.
                </div>
              )}
            </div>
          </div>
        </div>

        <AccountStatusCard affiliate={affiliate} />

        {/* Advanced Actions */}
        <div className="rounded-2xl border border-line bg-white shadow-sm flex flex-col">
          <div className="p-5 border-b border-line">
            <h2 className="font-heading text-base font-semibold text-ink leading-tight">Advanced Actions</h2>
            <p className="text-xs text-ink/50 mt-0.5">View raw data and internal tools.</p>
          </div>

          <div className="p-5 flex flex-col gap-3">
            <button
              onClick={() => setShowIpHistory(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line bg-page-bg/50 text-xs font-medium text-ink/80 hover:bg-page-bg transition"
            >
              <Globe className="w-4 h-4 text-ink/50" />
              View IP History
            </button>
          </div>
        </div>

      </div>

      {showIpHistory && (
        <IpHistoryModal clicks={affiliate.clicks || []} onClose={() => setShowIpHistory(false)} />
      )}
    </div>
  );
}

function IpHistoryModal({ clicks, onClose }: { clicks: Record<string, any>[]; onClose: () => void }) {
  const rows = clicks.filter((c) => c.ipHash).slice(0, 50);
  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-line flex items-center justify-between bg-page-bg/50">
          <h2 className="font-heading text-lg font-bold text-ink">IP History</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink transition">
            <Ban className="w-5 h-5 rotate-45" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {rows.length > 0 ? (
            <table className="w-full text-xs text-left">
              <thead className="bg-page-bg border-b border-line text-ink/60 sticky top-0">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">IP Hash</th>
                  <th className="px-5 py-3 font-medium">Suspicious</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c, idx) => (
                  <tr key={idx}>
                    <td className="px-5 py-3 text-ink/80">{new Date(c.createdAt).toLocaleString()}</td>
                    <td className="px-5 py-3 text-ink/80 font-mono text-[10px] truncate max-w-[160px]">{c.ipHash}</td>
                    <td className="px-5 py-3">
                      {c.isSuspicious ? (
                        <span className="text-error font-medium">Yes</span>
                      ) : (
                        <span className="text-ink/40">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-ink/50 text-xs">No IP data recorded for this affiliate.</div>
          )}
        </div>
      </div>
    </div>
  );
}
