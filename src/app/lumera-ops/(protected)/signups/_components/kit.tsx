"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";

// Small building blocks shared by the Customers and Sales Reps pages. They follow the look of the
// All Affiliates page: white rounded cards, soft borders, the navy primary colour.

/** Updates the page's URL search params; the server page re-reads them and refetches. */
export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (updates: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    // Any change other than moving between pages starts again from page one.
    if (updates.page === undefined) params.delete("page");
    for (const [key, value] of Object.entries(updates)) {
      const empty = value === undefined || value === "" || value === "all" || (key === "page" && Number(value) <= 1);
      if (empty) params.delete(key);
      else params.set(key, String(value));
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };
}

export function StatCard({
  icon,
  tone,
  label,
  value,
  trend,
  note,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: number;
  /** Percent change against the previous 30 days. */
  trend: number;
  /** Replaces the trend line, e.g. "71% of total". */
  note?: string;
}) {
  return (
    <div className="relative flex min-w-0 flex-col justify-center overflow-hidden rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className={`rounded-xl p-2.5 ${tone}`}>{icon}</div>
        <span className="text-sm font-semibold text-ink/70">{label}</span>
      </div>
      <div className="mb-1 font-heading text-3xl font-bold text-ink">{value.toLocaleString("en-US")}</div>
      {note ? (
        <div className="text-xs font-medium text-ink/50">{note}</div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {trend > 0 ? (
            <span className="text-green-600">↑ {trend}%</span>
          ) : trend < 0 ? (
            <span className="text-error">↓ {Math.abs(trend)}%</span>
          ) : (
            <span className="text-ink/40">↑ 0%</span>
          )}
          <span className="text-ink/40">vs. previous 30 days</span>
        </div>
      )}
    </div>
  );
}

const controlClass =
  "appearance-none cursor-pointer rounded-xl border border-transparent bg-page-bg py-2.5 pl-4 pr-10 text-sm font-medium transition hover:border-line focus:outline-none focus:ring-2 focus:ring-primary/20";

export function FilterSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <div className="relative">
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={controlClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-3 h-4 w-4 text-ink/50" />
    </div>
  );
}

/** Search box that waits for a pause in typing before it changes the URL. */
export function SearchBox({ initial, placeholder }: { initial: string; placeholder: string }) {
  const update = useUrlFilters();
  const [value, setValue] = useState(initial);

  useEffect(() => {
    if (value === initial) return;
    const timer = setTimeout(() => update({ q: value.trim() }), 450);
    return () => clearTimeout(timer);
    // `update` is rebuilt on every render; only a change in what was typed should restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, initial]);

  return (
    <div className="relative min-w-[220px] flex-1">
      <Search className="absolute left-3.5 top-3 h-4 w-4 text-ink/40" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-xl border border-transparent bg-page-bg py-2.5 pl-10 pr-4 text-sm transition placeholder:text-ink/40 hover:border-line focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

export function ExportButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium transition hover:bg-page-bg lg:w-auto"
    >
      <Download className="h-4 w-4 text-ink/60" />
      Export
    </a>
  );
}

export function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-line bg-white p-2 shadow-sm lg:flex-row">
      {children}
    </div>
  );
}

function pageList(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, 2, page - 1, page, page + 1, pages - 1, pages].filter((n) => n >= 1 && n <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

export function Pagination({
  page,
  pageSize,
  total,
  noun,
}: {
  page: number;
  pageSize: number;
  total: number;
  noun: string;
}) {
  const update = useUrlFilters();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const arrow = "rounded-lg border border-line bg-white p-1.5 text-ink/60 transition hover:text-ink disabled:opacity-40";

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-line bg-page-bg/30 px-6 py-4 sm:flex-row">
      <div className="text-sm font-medium text-ink/60">
        Showing {from} to {to} of {total.toLocaleString("en-US")} {noun}
      </div>
      <div className="flex items-center gap-1">
        <button aria-label="Previous page" disabled={page <= 1} onClick={() => update({ page: page - 1 })} className={arrow}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageList(page, pages).map((n, i) =>
          n === "…" ? (
            <span key={`gap${i}`} className="px-1.5 text-sm text-ink/40">
              …
            </span>
          ) : (
            <button
              key={n}
              onClick={() => update({ page: n })}
              className={`h-8 min-w-8 rounded-lg px-2 text-sm font-medium transition ${
                n === page ? "bg-primary text-white" : "text-ink/70 hover:bg-white"
              }`}
            >
              {n}
            </button>
          ),
        )}
        <button aria-label="Next page" disabled={page >= pages} onClick={() => update({ page: page + 1 })} className={arrow}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export interface MenuItem {
  label: string;
  onClick?: () => void;
  href?: string;
  tone?: "danger" | "good";
}

/** The ⋮ button at the end of a row. The list is fixed-positioned so a scrolling table can't clip it. */
export function RowMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) return setOpen(false);
    const rect = button.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setOpen(true);
  };

  const itemClass = (tone?: MenuItem["tone"]) =>
    `block w-full px-4 py-2 text-left text-sm transition ${
      tone === "danger"
        ? "text-error hover:bg-error/10"
        : tone === "good"
          ? "text-green-700 hover:bg-green-50"
          : "text-ink/80 hover:bg-page-bg hover:text-primary"
    }`;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        ref={button}
        onClick={toggle}
        aria-label="More actions"
        className="rounded-lg border border-line p-1.5 text-ink/50 transition hover:bg-page-bg hover:text-ink"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          style={{ top: pos.top, right: pos.right }}
          className="fixed z-[100] w-52 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg"
        >
          {items.map((item) =>
            item.href ? (
              <Link key={item.label} href={item.href} className={itemClass(item.tone)}>
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                className={itemClass(item.tone)}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The details column. Beside the table on wide screens; on narrower ones it slides over the page,
 * since a table plus a side column wouldn't fit.
 */
export function DetailPanel({
  title,
  onClose,
  tabs,
  tab,
  onTab,
  header,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  tabs: { key: string; label: string }[];
  tab: string;
  onTab: (key: string) => void;
  header: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm xl:static xl:z-auto xl:self-stretch xl:bg-transparent xl:backdrop-blur-none"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside className="ml-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-xl xl:sticky xl:top-4 xl:ml-0 xl:h-auto xl:max-h-[calc(100vh-2rem)] xl:max-w-none xl:rounded-2xl xl:border xl:border-line xl:shadow-sm">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-heading text-lg font-bold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close details" className="rounded-lg p-1 text-ink/40 transition hover:bg-page-bg hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="border-b border-line px-5 pb-0 pt-4">
          {header}
          <div className="-mb-px mt-4 flex gap-5 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => onTab(t.key)}
                className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition ${
                  t.key === tab ? "border-primary text-primary" : "border-transparent text-ink/50 hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 text-sm">{children}</div>
        {footer && <div className="space-y-2 border-t border-line bg-page-bg/30 p-4">{footer}</div>}
      </aside>
    </div>
  );
}

export function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="hidden items-center justify-center rounded-2xl border border-dashed border-line bg-white/60 p-10 text-center text-sm text-ink/45 xl:flex">
      {text}
    </div>
  );
}

/** One "label … value" line of the Overview tab, with an icon like the reference design. */
export function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="mt-0.5 text-ink/40">{icon}</span>
      <span className="w-32 shrink-0 text-ink/55">{label}</span>
      <span className="min-w-0 flex-1 break-words font-medium text-ink">{children}</span>
    </div>
  );
}

export function Backdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      {children}
    </div>,
    document.body,
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export function Notice({ tone, children }: { tone: "good" | "warn" | "bad"; children: React.ReactNode }) {
  const cls =
    tone === "good" ? "bg-emerald-50 text-emerald-700" : tone === "warn" ? "bg-amber-50 text-amber-700" : "bg-error/10 text-error";
  return <p className={`rounded-lg px-3 py-2 text-sm ${cls}`}>{children}</p>;
}

/** Copies text and briefly says so. Falls back silently where the clipboard is blocked. */
export function useCopy() {
  const [copied, setCopied] = useState(false);
  return {
    copied,
    copy: async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        window.prompt("Copy this link:", text);
      }
    },
  };
}

export function SignupsTabs({ customers, reps, pendingReps }: { customers: number; reps: number; pendingReps: number }) {
  const pathname = usePathname();
  const tab = (href: string, label: string, count: number, badge?: number) => {
    const active = pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-semibold transition ${
          active ? "border-primary text-primary" : "border-transparent text-ink/50 hover:text-ink"
        }`}
      >
        {label}
        <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-primary-light text-primary" : "bg-page-bg text-ink/50"}`}>
          {count.toLocaleString("en-US")}
        </span>
        {badge ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{badge} to review</span>
        ) : null}
      </Link>
    );
  };
  return (
    <nav className="flex gap-7 border-b border-line">
      {tab("/lumera-ops/signups/customers", "Customers", customers)}
      {tab("/lumera-ops/signups/sales-reps", "Sales reps", reps, pendingReps)}
    </nav>
  );
}
