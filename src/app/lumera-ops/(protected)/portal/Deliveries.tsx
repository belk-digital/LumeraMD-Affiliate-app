"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy, RotateCw, Send } from "lucide-react";
import {
  DetailPanel,
  EmptyPanel,
  FilterSelect,
  InfoRow,
  Notice,
  Pagination,
  Toolbar,
  useCopy,
  useUrlFilters,
} from "../signups/_components/kit";

export interface EventRow {
  id: string;
  type: string;
  status: string;
  attempts: number;
  lastError: string | null;
  email: string | null;
  created: string;
  delivered: string | null;
  /** When the next retry is due; only for events still being retried. */
  nextAttempt: string | null;
  payload: string;
}

const TYPE_LABELS: Record<string, string> = {
  "membership.payment_succeeded": "Payment received",
  "membership.cancelled": "Cancelled",
  "membership.expired": "Expired",
  "membership.complimentary_granted": "Free access granted",
};

const STATUS_FILTER = [
  { value: "all", label: "All notifications" },
  { value: "delivered", label: "Delivered" },
  { value: "pending", label: "Retrying" },
  { value: "failed", label: "Gave up" },
];

function DeliveryPill({ status, attempts }: { status: string; attempts: number }) {
  const [label, cls] =
    status === "delivered"
      ? ["Delivered", "bg-emerald-50 text-emerald-700"]
      : status === "failed"
        ? ["Gave up", "bg-rose-50 text-rose-600"]
        : attempts > 0
          ? ["Retrying", "bg-amber-50 text-amber-700"]
          : ["Sending", "bg-sky-50 text-sky-700"];
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{label}</span>;
}

/** What was sent to the portal, whether it arrived, and a way to send one again. */
export default function Deliveries({
  events,
  total,
  query,
  pageSize,
  configured,
}: {
  events: EventRow[];
  total: number;
  query: { status: string; page: number };
  pageSize: number;
  configured: boolean;
}) {
  const router = useRouter();
  const update = useUrlFilters();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState("details");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const { copied, copy } = useCopy();

  const active = events.find((e) => e.id === activeId) ?? null;

  async function resend(event: EventRow) {
    setBusy(true);
    setOutcome(null);
    const res = await fetch(`/api/lumera-ops/portal/events/${event.id}/resend`, { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setOutcome({ ok: false, text: data?.error ?? "Couldn't send it. Try again." });
    const sent = data.event as { status: string; lastError: string | null };
    setOutcome(
      sent.status === "delivered"
        ? { ok: true, text: "Delivered. The portal accepted it." }
        : { ok: false, text: `Not accepted: ${sent.lastError ?? "no answer"}.` },
    );
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-lg font-bold text-ink">Notifications sent to the portal</h2>
        <p className="mt-0.5 text-xs text-ink/55">Each membership change that was announced, and whether the portal accepted it.</p>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          <Toolbar>
            <FilterSelect
              label="Status"
              value={query.status || "all"}
              onChange={(v) => {
                setActiveId(null);
                update({ status: v });
              }}
              options={STATUS_FILTER}
            />
          </Toolbar>
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-left text-sm">
                <thead className="border-b border-line bg-page-bg/50 text-xs font-semibold text-ink/60">
                  <tr>
                    <th className="px-5 py-3.5">Event</th>
                    <th className="px-4 py-3.5">Member</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Tries</th>
                    <th className="px-4 py-3.5">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {events.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center font-medium text-ink/50">
                        {configured
                          ? "Nothing here yet. A notification appears as soon as a membership is paid, cancelled or expires."
                          : "Webhooks are off, so nothing is being sent."}
                      </td>
                    </tr>
                  )}
                  {events.map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => {
                        setActiveId(e.id);
                        setTab("details");
                        setOutcome(null);
                      }}
                      className={`cursor-pointer transition hover:bg-page-bg/40 ${e.id === activeId ? "bg-primary-light/40" : ""}`}
                    >
                      <td className="px-5 py-3.5 font-semibold">{TYPE_LABELS[e.type] ?? e.type}</td>
                      <td className="px-4 py-3.5 text-ink/70">{e.email ?? "—"}</td>
                      <td className="px-4 py-3.5">
                        <DeliveryPill status={e.status} attempts={e.attempts} />
                      </td>
                      <td className="px-4 py-3.5 text-ink/70">{e.attempts}</td>
                      <td className="px-4 py-3.5 text-ink/70">{e.created}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={query.page} pageSize={pageSize} total={total} noun="notifications" />
          </div>
        </div>

        {active ? (
          <DetailPanel
            key={active.id}
            title={TYPE_LABELS[active.type] ?? active.type}
            onClose={() => setActiveId(null)}
            tabs={[
              { key: "details", label: "Details" },
              { key: "payload", label: "What was sent" },
            ]}
            tab={tab}
            onTab={setTab}
            header={
              <div className="flex items-center gap-2 pb-1">
                <DeliveryPill status={active.status} attempts={active.attempts} />
                <span className="truncate text-xs text-ink/50">{active.email ?? ""}</span>
              </div>
            }
            footer={
              configured ? (
                <>
                  {outcome && <Notice tone={outcome.ok ? "good" : "warn"}>{outcome.text}</Notice>}
                  <button
                    onClick={() => resend(active)}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
                  >
                    <RotateCw className="h-4 w-4" />
                    {busy ? "Sending…" : "Send again"}
                  </button>
                  <p className="text-center text-xs text-ink/45">The portal may receive this more than once. It is built to ignore repeats.</p>
                </>
              ) : undefined
            }
          >
            {tab === "details" ? (
              <div>
                <InfoRow icon={<Send className="h-4 w-4" />} label="Sent">
                  {active.created}
                </InfoRow>
                <InfoRow icon={<Check className="h-4 w-4" />} label="Delivered">
                  {active.delivered ?? "Not yet"}
                </InfoRow>
                <InfoRow icon={<RotateCw className="h-4 w-4" />} label="Tries">
                  {active.attempts}
                </InfoRow>
                {active.nextAttempt && (
                  <InfoRow icon={<RotateCw className="h-4 w-4" />} label="Next retry">
                    {active.nextAttempt}
                  </InfoRow>
                )}
                {active.lastError && (
                  <div className="mt-3">
                    <Notice tone="warn">Last problem: {active.lastError}</Notice>
                  </div>
                )}
                {active.status === "failed" && (
                  <p className="mt-3 text-xs text-ink/55">
                    It was tried the maximum number of times. Fix the portal&apos;s address or ask them to check their server, then send it again.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => copy(active.payload)}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary transition hover:underline"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <pre className="max-h-96 overflow-auto rounded-xl bg-[#0f1b2a] p-4 text-xs leading-relaxed text-slate-100">{active.payload}</pre>
              </div>
            )}
          </DetailPanel>
        ) : (
          <EmptyPanel text="Select a notification to see whether it arrived and what was sent." />
        )}
      </div>
    </div>
  );
}
