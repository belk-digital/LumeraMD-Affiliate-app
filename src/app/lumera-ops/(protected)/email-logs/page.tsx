import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import StatusPill from "@/components/StatusPill";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const STATUSES = ["sent", "logged", "failed"] as const;
const RANGES: Record<string, number> = { "1": 1, "7": 7, "30": 30 };

/** A moment this many days ago (kept out of the component so it renders purely). */
function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const first = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

const fmt = (d: Date) =>
  d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

function hrefFor(params: Record<string, string>, page: number) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return `/lumera-ops/email-logs${qs ? `?${qs}` : ""}`;
}

// Every email the app has tried to send, newest first: who it went to, the subject and whether it left.
// Bodies are not stored (they can contain sign-in links), only this record.
export default async function EmailLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 100);
  const status = (STATUSES as readonly string[]).includes(first(sp.status)) ? first(sp.status) : "";
  const range = first(sp.range) in RANGES ? first(sp.range) : "";
  const pageNum = Math.max(1, parseInt(first(sp.page), 10) || 1);

  const where: Prisma.EmailLogWhereInput = {};
  if (q) where.OR = [{ toEmail: { contains: q, mode: "insensitive" } }, { subject: { contains: q, mode: "insensitive" } }];
  if (status) where.status = status;
  if (range) where.createdAt = { gte: daysAgo(RANGES[range]) };

  const dayAgo = daysAgo(1);
  const [rows, total, sent24, failed24, logged24] = await Promise.all([
    prisma.emailLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (pageNum - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.emailLog.count({ where }),
    prisma.emailLog.count({ where: { status: "sent", createdAt: { gte: dayAgo } } }),
    prisma.emailLog.count({ where: { status: "failed", createdAt: { gte: dayAgo } } }),
    prisma.emailLog.count({ where: { status: "logged", createdAt: { gte: dayAgo } } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const keep = { q, status, range };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-ink">Email logs</h1>
        <p className="mt-1.5 text-sm font-medium text-ink/60">
          Every email the app sends, to customers, affiliates and admins. Only the recipient, subject and result are kept, never the
          message itself.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["Sent, last 24 hours", sent24, "text-emerald-600"],
          ["Failed, last 24 hours", failed24, failed24 > 0 ? "text-rose-600" : "text-ink"],
          ["Not sent (no provider), last 24 hours", logged24, "text-ink"],
        ].map(([label, value, cls]) => (
          <div key={String(label)} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-ink/50">{label}</p>
            <p className={`mt-1 font-heading text-3xl font-bold ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      <form method="get" className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by recipient or subject"
          className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
        >
          <option value="">All results</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="logged">Not sent (no provider)</option>
        </select>
        <select
          name="range"
          defaultValue={range}
          className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
        >
          <option value="">All time</option>
          <option value="1">Last 24 hours</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
        <button type="submit" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark">
          Filter
        </button>
        {(q || status || range) && (
          <Link href="/lumera-ops/email-logs" className="text-center text-sm font-medium text-primary hover:underline">
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-page-bg/60 text-xs font-medium uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">To</th>
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-ink/50">
                    {q || status || range ? "No emails match those filters." : "No emails have been sent yet."}
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap px-5 py-3.5 text-ink/70">{fmt(r.createdAt)}</td>
                  <td className="px-5 py-3.5 font-medium text-ink">{r.toEmail}</td>
                  <td className="px-5 py-3.5 text-ink/80">{r.subject}</td>
                  <td className="px-5 py-3.5">
                    <StatusPill status={r.status} />
                    {r.status === "logged" && <p className="mt-1 max-w-[16rem] text-xs text-ink/50">No email provider is set up here, so nothing was delivered.</p>}
                    {r.error && <p className="mt-1 max-w-[16rem] break-words text-xs text-rose-600">{r.error}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm text-ink/60">
          <span>
            {total === 0 ? "0 emails" : `${(pageNum - 1) * PAGE_SIZE + 1}–${Math.min(pageNum * PAGE_SIZE, total)} of ${total}`}
          </span>
          <div className="flex gap-2">
            {pageNum > 1 ? (
              <Link href={hrefFor(keep, pageNum - 1)} className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink/80 hover:bg-page-bg">
                Previous
              </Link>
            ) : (
              <span className="rounded-lg border border-line px-3 py-1.5 text-ink/30">Previous</span>
            )}
            {pageNum < pages ? (
              <Link href={hrefFor(keep, pageNum + 1)} className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink/80 hover:bg-page-bg">
                Next
              </Link>
            ) : (
              <span className="rounded-lg border border-line px-3 py-1.5 text-ink/30">Next</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
