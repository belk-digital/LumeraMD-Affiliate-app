"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import type { MemberOrder, OrderStatus } from "@/lib/shopify/orders";

const STATUS_LABEL: Record<OrderStatus, string> = {
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const STATUS_TONE: Record<OrderStatus, string> = {
  processing: "bg-amber-50 text-amber-700",
  shipped: "bg-sky-50 text-sky-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-600",
};
const FILTERS: ("all" | OrderStatus)[] = ["all", "processing", "shipped", "delivered", "cancelled"];
const RANGES = [
  { label: "Last 3 months", days: 90 },
  { label: "Last 6 months", days: 180 },
  { label: "Last 12 months", days: 365 },
  { label: "All time", days: 0 },
];

const date = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const money = (n: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

const control =
  "rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export default function OrdersClient({ orders, error, email }: { orders: MemberOrder[]; error: string | null; email: string }) {
  const [status, setStatus] = useState<"all" | OrderStatus>("all");
  const [query, setQuery] = useState("");
  const [days, setDays] = useState(180);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    // eslint-disable-next-line react-hooks/purity -- a fresh "now" per filter change is what we want
    const cutoff = days > 0 ? Date.now() - days * 24 * 60 * 60 * 1000 : 0;
    return orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (cutoff && new Date(o.createdAt).getTime() < cutoff) return false;
      if (q && !(o.name.toLowerCase().includes(q) || o.items.some((i) => i.title.toLowerCase().includes(q)))) return false;
      return true;
    });
  }, [orders, status, query, days]);

  const count = (s: "all" | OrderStatus) => (s === "all" ? orders.length : orders.filter((o) => o.status === s).length);

  return (
    <section className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Order status">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={status === f}
            onClick={() => setStatus(f)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              status === f ? "bg-primary text-white" : "bg-page-bg text-ink/65 hover:bg-primary-light"
            }`}
          >
            {f === "all" ? "All" : STATUS_LABEL[f]} <span className="opacity-60">{count(f)}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          placeholder="Search by order number or item"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${control} sm:flex-1`}
          aria-label="Search orders"
        />
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={control} aria-label="Date range">
          {RANGES.map((r) => (
            <option key={r.days} value={r.days}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        {error ? (
          <div className="rounded-xl bg-rose-50 px-4 py-8 text-center text-sm text-rose-700">{error}</div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl bg-page-bg/60 px-4 py-10 text-center text-sm text-ink/55">
            <Icon name="bag" className="mx-auto mb-2 h-6 w-6 text-ink/30" />
            {orders.length === 0
              ? `No orders yet. Orders placed with ${email} will show up here.`
              : "No orders match these filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-page-bg text-left text-xs font-medium text-ink/60">
                  <th className="rounded-l-lg px-3 py-2.5">Order</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Items</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="rounded-r-lg px-3 py-2.5 text-right">View</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-3 font-medium text-ink">{o.name}</td>
                    <td className="px-3 py-3 text-ink/70">{date(o.createdAt)}</td>
                    <td className="px-3 py-3 text-ink/70" title={o.items.map((i) => `${i.quantity} × ${i.title}`).join(", ")}>
                      {o.itemCount} {o.itemCount === 1 ? "item" : "items"}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-ink">{money(o.total, o.currency)}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONE[o.status]}`}>
                        {STATUS_LABEL[o.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {o.statusUrl ? (
                        <a href={o.statusUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                          View
                        </a>
                      ) : (
                        <span className="text-ink/30">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
