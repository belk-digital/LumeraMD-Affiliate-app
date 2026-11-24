// Input cleaners for the public forms: they strip what a field should never contain as the person
// types, so a name can't hold digits and an amount can't hold letters. Servers still validate.

/** Letters (any language), spaces, apostrophes, hyphens and periods. */
export const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s'’.\-]*$/u;
export const NAME_MAX = 60;

export function cleanName(v: string): string {
  return v
    .replace(/[^\p{L}\p{M}\s'’.\-]/gu, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s'’.\-]+/, "")
    .slice(0, NAME_MAX);
}

export function isValidName(v: string): boolean {
  return v.length > 0 && v.length <= NAME_MAX && NAME_PATTERN.test(v);
}

export const NAME_ERROR = "Names can only include letters, spaces, apostrophes, hyphens and periods.";

export function cleanEmail(v: string): string {
  return v.replace(/\s/g, "").slice(0, 254);
}

/** Digits with at most one decimal point and two decimals. */
export function cleanAmount(v: string): string {
  const stripped = v.replace(/[^\d.]/g, "");
  const [whole, ...rest] = stripped.split(".");
  const out = rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
  return out.slice(0, 13);
}
