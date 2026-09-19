"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useReducedMotion } from "@/lib/useReducedMotion";

export interface ChartTab {
  key: string;
  label: string;
  kind: "money" | "count";
  /** Singular/plural noun used in the tooltip, e.g. "click" / "clicks". */
  one: string;
  other: string;
}

export type ChartPoint = { label: string; full: string } & Record<string, number | string>;

const INDIGO = "#4f46e5";

function tooltipValue(tab: ChartTab, v: number) {
  if (tab.kind === "count") return `${v} ${v === 1 ? tab.one : tab.other}`;
  const money = `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${money} ${tab.other}`;
}

function axisValue(tab: ChartTab, v: number) {
  if (tab.kind === "count") return String(v);
  return v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `$${v}`;
}

export default function PerformanceChart({
  title,
  series,
  tabs,
  days,
}: {
  title: string;
  series: ChartPoint[];
  tabs: ChartTab[];
  days: number;
}) {
  const reduced = useReducedMotion();
  const [tabKey, setTabKey] = useState(tabs[0].key);
  const [active, setActive] = useState<string | null>(null);
  const tab = tabs.find((t) => t.key === tabKey) ?? tabs[0];

  const hasData = series.some((p) => Number(p[tab.key]) > 0);

  // Evenly spaced x ticks, counted back from the latest day, sized to the chart's real width.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const ticks = useMemo(() => {
    const maxTicks = Math.max(3, Math.floor(width / 84));
    const step = Math.ceil(series.length / maxTicks);
    return series.filter((_, i) => (series.length - 1 - i) % step === 0).map((p) => p.label);
  }, [series, width]);

  return (
    <div className="animate-fade-up h-full rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold text-ink">{title}</h2>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-xl border border-line bg-page-bg p-0.5">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTabKey(t.key)}
                aria-pressed={tab.key === t.key}
                className={`rounded-[10px] px-3.5 py-1.5 text-sm transition ${
                  tab.key === t.key
                    ? "bg-primary font-medium text-white shadow-sm"
                    : "text-ink/60 hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <span className="hidden rounded-xl border border-line px-3 py-2 text-sm text-ink/60 sm:block">
            Last {days} days
          </span>
        </div>
      </div>

      <div className="relative mt-4" ref={wrapperRef}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={series}
            margin={{ top: 16, right: 28, left: -8, bottom: 0 }}
            onMouseMove={(state) =>
              setActive(state?.activeLabel != null ? String(state.activeLabel) : null)
            }
            onMouseLeave={() => setActive(null)}
          >
            <defs>
              <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={INDIGO} stopOpacity={0.22} />
                <stop offset="100%" stopColor={INDIGO} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e8eaf3" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              ticks={ticks}
              interval={0}
              tick={({ x, y, payload }) => (
                <text
                  x={x}
                  y={Number(y) + 16}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={payload.value === active ? 600 : 400}
                  fill={payload.value === active ? INDIGO : "#1b1d2899"}
                >
                  {payload.value}
                </text>
              )}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={48}
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "#1b1d2899" }}
              tickFormatter={(v: number) => axisValue(tab, v)}
            />
            <Tooltip
              cursor={{ stroke: "#c7cbf2", strokeDasharray: "4 4" }}
              content={({ active: isActive, payload }) => {
                if (!isActive || !payload?.length) return null;
                const p = payload[0].payload as ChartPoint;
                return (
                  <div className="rounded-xl bg-[#1b1d28] px-3.5 py-2.5 text-white shadow-lg">
                    <div className="text-xs text-white/70">{p.full}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#818cf8]" />
                      {tooltipValue(tab, Number(p[tab.key]))}
                    </div>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey={tab.key}
              stroke={INDIGO}
              strokeWidth={2.5}
              fill="url(#perfFill)"
              activeDot={{ r: 5, fill: INDIGO, stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive={!reduced}
              animationDuration={1100}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
        {!hasData && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-8 text-sm text-ink/40">
            No activity in this period
          </div>
        )}
      </div>
    </div>
  );
}
