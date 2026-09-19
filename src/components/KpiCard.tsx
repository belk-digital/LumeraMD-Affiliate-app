import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import CountUp from "@/components/CountUp";
import type { ValueFormat } from "@/lib/format";

export default function KpiCard({
  label,
  value,
  format = "int",
  icon,
  change,
  days,
  href,
  inverse = false,
  index = 0,
}: {
  label: string;
  value: number;
  format?: ValueFormat;
  icon: IconName;
  change: number;
  days: number;
  /** Omit to render a non-clickable card. */
  href?: string;
  /** For liabilities like "commission owed", where an increase is bad news. */
  inverse?: boolean;
  /** Position in its row, used to stagger the entrance animation. */
  index?: number;
}) {
  const direction = Math.round(change) === 0 ? 0 : change > 0 ? 1 : -1;
  const good = inverse ? direction < 0 : direction > 0;
  // Greens/reds sampled from the reference design.
  const tone = direction === 0 ? "text-ink/40" : good ? "text-[#3f8a54]" : "text-[#d9462e]";

  const className =
    "animate-fade-up block min-w-0 rounded-2xl border border-line bg-white p-3.5 shadow-sm transition hover:border-primary/30 hover:shadow-md";
  const style = { "--delay": `${index * 70}ms` } as React.CSSProperties;

  const body = (
    <>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
          <Icon name={icon} className="h-[17px] w-[17px]" />
        </span>
        <span className="text-xs leading-tight text-ink/70">{label}</span>
      </div>

      <div className="mt-3.5 font-heading text-[28px] font-semibold leading-none text-ink">
        <CountUp value={value} format={format} />
      </div>

      <div className="mt-2.5 whitespace-nowrap">
        <div className={`flex items-center gap-1 text-[15px] font-semibold leading-tight ${tone}`}>
          {direction !== 0 && (
            <Icon
              name={direction > 0 ? "arrowUp" : "arrowDown"}
              className="h-4 w-4"
              strokeWidth={2.4}
            />
          )}
          {Math.abs(Math.round(change))}%
        </div>
        <div className="mt-1 text-xs text-ink/45">vs. previous {days} days</div>
      </div>
    </>
  );

  return href ? (
    <Link href={href} className={className} style={style}>
      {body}
    </Link>
  ) : (
    <div className={className} style={style}>
      {body}
    </div>
  );
}
