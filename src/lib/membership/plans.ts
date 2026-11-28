// Membership packages. The values below are the DEFAULTS, from the client's "Membership Options" tab; an admin can
// customize every plan on the Plans page (stored in the database), and the app reads the result through
// getCatalog() in plans.server.ts. This file stays free of database code so forms can import its types.

export type PlanKey = "agent" | "customer_basic" | "customer_plus" | "customer_premium";
export type CustomerPlanKey = Exclude<PlanKey, "agent">;

export interface MembershipPlan {
  key: PlanKey;
  name: string;
  audience: "agent" | "customer";
  monthlyPrice: number; // USD
  /** Regular price, shown struck through next to a discounted monthlyPrice. */
  listPrice?: number;
  /** % off web pricing (customers). */
  webDiscountPercent: number;
  benefits: string[];
  /** Telehealth consultations included with the membership. */
  consultations: number;
  overrideEligible: boolean;
  /** Test kit price for members of this plan; falls back to the standard test kit price. */
  testKitPrice?: number;
}

export const DEFAULT_TEST_KIT_PRICE = 699;

export const DEFAULT_PLANS: Record<PlanKey, MembershipPlan> = {
  agent: {
    key: "agent",
    // The agent plan is the customer Premium plan at a discounted $79 (list $179), plus overrides.
    name: "Premium",
    audience: "agent",
    monthlyPrice: 79,
    listPrice: 179,
    webDiscountPercent: 15,
    benefits: [
      "15% off web pricing",
      "Deeper discounts on peptides and supplements",
      "Updated DNA results",
      "2 consultations",
      "Test kit for $499",
      "Access to wellness",
      "Discount on wellness",
      "Override commissions",
    ],
    consultations: 2,
    overrideEligible: true,
    testKitPrice: 499,
  },
  customer_basic: {
    key: "customer_basic",
    name: "Basic",
    audience: "customer",
    monthlyPrice: 49,
    webDiscountPercent: 5,
    benefits: ["5% off web pricing", "Discounts on peptides and supplements"],
    consultations: 0,
    overrideEligible: false,
  },
  customer_plus: {
    key: "customer_plus",
    name: "Plus",
    audience: "customer",
    monthlyPrice: 79,
    webDiscountPercent: 10,
    benefits: [
      "10% off web pricing",
      "Discounts on peptides and supplements",
      "Access to DNA testing",
      "1 consultation",
      "Test kit for $599",
      "Access to wellness",
    ],
    consultations: 1,
    overrideEligible: false,
    testKitPrice: 599,
  },
  customer_premium: {
    key: "customer_premium",
    name: "Premium",
    audience: "customer",
    monthlyPrice: 179,
    webDiscountPercent: 15,
    benefits: [
      "15% off web pricing",
      "Deeper discounts on peptides and supplements",
      "Updated DNA results",
      "2 consultations",
      "Test kit for $499",
      "Access to wellness",
      "Discount on wellness",
    ],
    consultations: 2,
    overrideEligible: false,
    testKitPrice: 499,
  },
};

export const PLAN_KEYS = Object.keys(DEFAULT_PLANS) as PlanKey[];
export const CUSTOMER_PLAN_KEYS: CustomerPlanKey[] = ["customer_basic", "customer_plus", "customer_premium"];

export function isPlanKey(value: string): value is PlanKey {
  return (PLAN_KEYS as string[]).includes(value);
}

export function isCustomerPlanKey(value: string): value is CustomerPlanKey {
  return (CUSTOMER_PLAN_KEYS as string[]).includes(value);
}

/** A stored customization of one plan (the fields an admin can change). */
export interface PlanOverride {
  key: string;
  name: string;
  monthlyPrice: number;
  listPrice: number | null;
  webDiscountPercent: number;
  consultations: number;
  testKitPrice: number | null;
  overrideEligible: boolean;
  benefits: string[];
}

/** The plans as the app currently sells them: defaults, with any admin customizations applied. */
export interface PlanCatalog {
  plans: Record<PlanKey, MembershipPlan>;
  customerPlans: MembershipPlan[];
  /** The standard test kit price, which plans with their own test kit price undercut. */
  testKitPrice: number;
}

export function buildCatalog(overrides: PlanOverride[], testKitPrice?: number | null): PlanCatalog {
  const plans = {} as Record<PlanKey, MembershipPlan>;
  for (const key of PLAN_KEYS) {
    const base = DEFAULT_PLANS[key];
    const o = overrides.find((x) => x.key === key);
    plans[key] = o
      ? {
          ...base,
          name: o.name,
          monthlyPrice: o.monthlyPrice,
          listPrice: o.listPrice ?? undefined,
          webDiscountPercent: o.webDiscountPercent,
          consultations: o.consultations,
          testKitPrice: o.testKitPrice ?? undefined,
          overrideEligible: o.overrideEligible,
          benefits: o.benefits,
        }
      : { ...base, benefits: [...base.benefits] };
  }
  return {
    plans,
    customerPlans: CUSTOMER_PLAN_KEYS.map((k) => plans[k]),
    testKitPrice: testKitPrice ?? DEFAULT_TEST_KIT_PRICE,
  };
}

/** What a member pays each month: the price fixed when they first paid, else the plan's current price. */
export function monthlyPriceFor(c: { lockedMonthlyPrice: number | null }, plan: { monthlyPrice: number }): number {
  return c.lockedMonthlyPrice ?? plan.monthlyPrice;
}

/** What this plan's members pay for a test kit. */
export function testKitPriceFor(catalog: PlanCatalog, plan: PlanKey | null): number {
  return (plan && catalog.plans[plan]?.testKitPrice) || catalog.testKitPrice;
}
