export type ValueFormat = "int" | "money";

/** Whole dollars once amounts reach four figures, cents below that. */
export function formatMoney(n: number) {
  const big = Math.abs(n) >= 1000;
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: big ? 0 : 2,
    maximumFractionDigits: big ? 0 : 2,
  })}`;
}

export function formatInt(n: number) {
  return Math.round(n).toLocaleString("en-US");
}

export function formatValue(n: number, format: ValueFormat) {
  return format === "money" ? formatMoney(n) : formatInt(n);
}
