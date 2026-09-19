"use client";

import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import Icon from "@/components/Icon";
import CountUp from "@/components/CountUp";
import { formatValue, type ValueFormat } from "@/lib/format";
import { useReducedMotion } from "@/lib/useReducedMotion";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

const VIOLET = "#4f46e5";

export default function DonutCard({
  title,
  slices,
  totalLabel,
  format = "money",
  href,
  hrefLabel = "View all",
  variant = "violet",
  footer,
  index = 0,
}: {
  title: string;
  slices: DonutSlice[];
  totalLabel: string;
  format?: ValueFormat;
  href?: string;
  hrefLabel?: string;
  /** Violet card with light marks, or a white card with regular ones. */
  variant?: "violet" | "white";
  footer?: React.ReactNode;
  index?: number;
}) {
  const reduced = useReducedMotion();
  const violet = variant === "violet";
  const total = slices.reduce((acc, s) => acc + s.value, 0);
  const data = slices.filter((s) => s.value > 0);

  const text = {
    title: violet ? "text-white" : "text-ink",
    link: violet ? "text-white/90 hover:text-white" : "text-primary",
    label: violet ? "text-white/70" : "text-ink/60",
    sub: violet ? "text-white/60" : "text-ink/40",
    total: violet ? "text-white" : "text-ink",
  };

  return (
    <div
      className={`animate-fade-up flex h-full flex-col rounded-2xl border p-5 shadow-sm ${
        violet ? "border-primary bg-primary text-white" : "border-line bg-white"
      }`}
      style={{ "--delay": `${index * 70}ms` } as React.CSSProperties}
    >
      <div className="flex items-center justify-between">
        <h2 className={`font-heading text-lg font-semibold ${text.title}`}>{title}</h2>
        {href && (
          <Link
            href={href}
            className={`flex items-center gap-1 text-sm font-medium hover:underline ${text.link}`}
          >
            {hrefLabel} <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        )}
      </div>

      <div className="mt-5 flex flex-1 flex-col items-center justify-center gap-6 sm:flex-row">
        <div className="relative h-48 w-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={total === 0 ? [{ key: "empty", value: 1 }] : data}
                dataKey="value"
                innerRadius={62}
                outerRadius={90}
                startAngle={90}
                endAngle={-270}
                stroke={violet ? VIOLET : "#ffffff"}
                strokeWidth={2}
                isAnimationActive={!reduced}
                animationBegin={150}
                animationDuration={1100}
                animationEasing="ease-out"
              >
                {total === 0 ? (
                  <Cell fill={violet ? "rgba(255,255,255,0.18)" : "#eceef7"} />
                ) : (
                  data.map((d) => <Cell key={d.key} fill={d.color} />)
                )}
              </Pie>
              {total > 0 && (
                <Tooltip
                  formatter={(v) => formatValue(Number(v), format)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "none",
                    background: "#1b1d28",
                    color: "#fff",
                    fontSize: 12,
                  }}
                  itemStyle={{ color: "#fff" }}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className={`font-heading text-xl font-semibold ${text.total}`}>
              <CountUp value={total} format={format} duration={1100} />
            </span>
            <span className={`text-xs ${text.label}`}>{totalLabel}</span>
          </div>
        </div>

        <ul className="w-full space-y-4">
          {slices.map((s) => (
            <li key={s.key} className="flex items-start gap-3">
              <span
                className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <div>
                <div className={`text-sm ${text.label}`}>{s.label}</div>
                <div
                  className={`font-heading text-lg font-semibold leading-tight ${
                    violet ? "text-white" : "text-ink"
                  }`}
                >
                  {formatValue(s.value, format)}
                </div>
                <div className={`text-xs ${text.sub}`}>
                  {total > 0 ? Math.round((s.value / total) * 100) : 0}%
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {footer && (
        <div className={`mt-5 border-t pt-4 ${violet ? "border-white/20" : "border-line"}`}>
          {footer}
        </div>
      )}
    </div>
  );
}
