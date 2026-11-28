import { DEFAULT_PLANS, isPlanKey, type PlanKey } from "@/lib/membership/plans";

// Validation for the admin Plans page: what an admin may change about a membership package, and the limits.

export interface PlanInput {
  name: string;
  monthlyPrice: number;
  listPrice: number | null;
  webDiscountPercent: number;
  consultations: number;
  testKitPrice: number | null;
  benefits: string[];
}

export const MAX_BENEFITS = 20;

const money = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.replace(/[$,\s]/g, "")) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};
const whole = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.trim()) : typeof v === "number" ? v : NaN;
  return Number.isInteger(n) ? n : null;
};
const blank = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

export function parsePlanKey(key: string): PlanKey | null {
  return isPlanKey(key) ? key : null;
}

export function parsePlanInput(body: Record<string, unknown>): { ok: true; value: PlanInput } | { ok: false; error: string } {
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > 40) return { ok: false, error: "Enter a plan name of up to 40 characters." };

  const monthlyPrice = money(body.monthlyPrice);
  if (monthlyPrice === null || monthlyPrice < 1 || monthlyPrice > 10000) {
    return { ok: false, error: "The monthly price must be between $1 and $10,000." };
  }

  let listPrice: number | null = null;
  if (!blank(body.listPrice)) {
    listPrice = money(body.listPrice);
    if (listPrice === null || listPrice < monthlyPrice || listPrice > 100000) {
      return { ok: false, error: "The regular (struck-through) price must be at least the monthly price. Leave it empty to show no discount." };
    }
  }

  const webDiscountPercent = whole(body.webDiscountPercent);
  if (webDiscountPercent === null || webDiscountPercent < 0 || webDiscountPercent > 100) {
    return { ok: false, error: "The web discount must be a whole number from 0 to 100." };
  }

  const consultations = whole(body.consultations);
  if (consultations === null || consultations < 0 || consultations > 50) {
    return { ok: false, error: "Included consultations must be a whole number from 0 to 50." };
  }

  let testKitPrice: number | null = null;
  if (!blank(body.testKitPrice)) {
    testKitPrice = money(body.testKitPrice);
    if (testKitPrice === null || testKitPrice < 0 || testKitPrice > 100000) {
      return { ok: false, error: "The member test kit price must be between $0 and $100,000, or empty to use the standard price." };
    }
  }

  const rawBenefits = Array.isArray(body.benefits)
    ? body.benefits
    : typeof body.benefits === "string"
      ? body.benefits.split("\n")
      : [];
  const benefits = rawBenefits
    .filter((b): b is string => typeof b === "string")
    .map((b) => b.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  if (benefits.length === 0) return { ok: false, error: "Add at least one benefit." };
  if (benefits.length > MAX_BENEFITS) return { ok: false, error: `Use at most ${MAX_BENEFITS} benefits.` };
  if (benefits.some((b) => b.length > 120)) return { ok: false, error: "Each benefit must be 120 characters or fewer." };

  return { ok: true, value: { name, monthlyPrice, listPrice, webDiscountPercent, consultations, testKitPrice, benefits } };
}

/** The test kit standard price: $1 to $100,000. */
export function parseTestKitPrice(v: unknown): number | null {
  const n = money(v);
  return n !== null && n >= 1 && n <= 100000 ? n : null;
}

export const defaultOverrideEligible = (key: PlanKey) => DEFAULT_PLANS[key].overrideEligible;
