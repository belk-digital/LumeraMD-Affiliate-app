import Link from "next/link";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import { formatMoney as money } from "@/lib/format";

interface Row {
  affiliateId: string;
  name: string;
  conversions: number;
  revenue: number;
  commission: number;
}

const RANK_STYLES = [
  "bg-amber-400 text-white",
  "bg-slate-300 text-white",
  "bg-orange-400 text-white",
];

export default function TopAffiliates({ rows }: { rows: Row[] }) {
  return (
    <div className="animate-fade-up h-full rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-ink">Top Affiliates</h2>
        <Link
          href="/lumera-ops/affiliates"
          className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View all <Icon name="arrowRight" className="h-4 w-4" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[380px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-page-bg text-left text-xs font-medium text-ink/60">
              <th className="rounded-l-xl px-2 py-3">#</th>
              <th className="px-2 py-3">Affiliate</th>
              <th className="px-2 py-3">Conversions</th>
              <th className="px-2 py-3">Revenue</th>
              <th className="rounded-r-xl px-2 py-3">Commission</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.affiliateId} className="border-b border-line last:border-0">
                <td className="px-2 py-3">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      RANK_STYLES[i] ?? "text-ink/60"
                    }`}
                  >
                    {i + 1}
                  </span>
                </td>
                <td className="px-2 py-3">
                  <Link
                    href={`/lumera-ops/affiliates/${r.affiliateId}`}
                    className="flex items-center gap-2.5 hover:text-primary"
                  >
                    <Avatar name={r.name} size="sm" />
                    <span className="max-w-[120px] truncate font-medium text-ink">{r.name}</span>
                  </Link>
                </td>
                <td className="px-2 py-3 text-ink/70">{r.conversions}</td>
                <td className="whitespace-nowrap px-2 py-3 text-ink/70">{money(r.revenue)}</td>
                <td className="whitespace-nowrap px-2 py-3 text-ink/70">{money(r.commission)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-ink/40">
                  No conversions in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
