import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";

// Small building blocks shared by every member dashboard page, so they all look the same.

export const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
export const fmtDateLong = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
export const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;

/** Page wrapper: consistent padding and width. */
export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6">{children}</div>;
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="animate-fade-up">
      <h1 className="font-heading text-2xl font-bold text-ink md:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-ink/60">{subtitle}</p>}
    </div>
  );
}

export function Card({
  title,
  icon,
  action,
  children,
  className = "",
}: {
  title?: string;
  icon?: IconName;
  /** A small link on the right of the title, e.g. "View all". */
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-line bg-white p-5 shadow-sm ${className}`}>
      {title && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2.5 font-heading text-base font-semibold text-ink md:text-lg">
            {icon && (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-primary">
                <Icon name={icon} className="h-4 w-4" />
              </span>
            )}
            {title}
          </h2>
          {action && (
            <Link href={action.href} className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
              {action.label}
              <Icon name="arrowRight" className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

type Tone = "green" | "amber" | "red" | "slate" | "blue";
const TONES: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-600",
  blue: "bg-sky-50 text-sky-700",
};

export function Badge({ tone = "slate", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${TONES[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {children}
    </span>
  );
}

export const MEMBERSHIP_TONE: Record<string, Tone> = {
  active: "green",
  pending_payment: "amber",
  past_due: "red",
  cancelled: "slate",
};
export const MEMBERSHIP_LABEL: Record<string, string> = {
  active: "Active",
  pending_payment: "Pending payment",
  past_due: "Past due",
  cancelled: "Cancelled",
};

export function StatCard({
  icon,
  label,
  value,
  suffix,
  sub,
  badge,
}: {
  icon: IconName;
  label: string;
  value: React.ReactNode;
  suffix?: string;
  sub?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="animate-fade-up min-w-0 rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
            <Icon name={icon} className="h-4 w-4" />
          </span>
          <span className="truncate text-xs text-ink/65">{label}</span>
        </div>
        {badge}
      </div>
      <div className="mt-3 font-heading text-2xl font-semibold leading-none text-ink">
        {value}
        {suffix && <span className="ml-1.5 text-sm font-normal text-ink/50">{suffix}</span>}
      </div>
      {sub && <div className="mt-1.5 text-xs text-ink/50">{sub}</div>}
    </div>
  );
}

/** A plain table: header row on a tinted bar, thin row dividers, a friendly empty state. */
export function DataTable({
  headers,
  rows,
  empty,
  align = [],
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty: React.ReactNode;
  /** Per-column alignment; defaults to left. */
  align?: ("left" | "right")[];
}) {
  if (rows.length === 0) return <div className="rounded-xl bg-page-bg/60 px-4 py-8 text-center text-sm text-ink/50">{empty}</div>;
  const cls = (i: number) => (align[i] === "right" ? "text-right" : "text-left");
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-page-bg text-xs font-medium text-ink/60">
            {headers.map((h, i) => (
              <th
                key={h}
                className={`px-3 py-2.5 ${cls(i)} ${i === 0 ? "rounded-l-lg" : ""} ${i === headers.length - 1 ? "rounded-r-lg" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-line last:border-0">
              {row.map((cell, c) => (
                <td key={c} className={`px-3 py-3 text-ink/75 ${cls(c)}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Points shown with a sign and colour: + green, − muted. */
export function PointsDelta({ cents }: { cents: number }) {
  const positive = cents >= 0;
  return (
    <span className={`font-medium ${positive ? "text-emerald-700" : "text-ink/70"}`}>
      {positive ? "+" : "−"}
      {(Math.abs(cents) / 100).toFixed(2)}
    </span>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "outline";
  external?: boolean;
}) {
  const cls =
    variant === "primary"
      ? "bg-primary text-white hover:bg-primary-dark"
      : "border border-line bg-white text-ink/80 hover:bg-page-bg";
  const className = `inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${cls}`;
  if (external || href.startsWith("mailto:")) {
    return (
      <a href={href} className={className} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
