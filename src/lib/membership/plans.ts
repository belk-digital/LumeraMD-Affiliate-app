// Membership plans and test kit pricing, from the client's "Membership Options" tab.
// Benefits are expected to change as the program is finalized — edit here, nothing else needs to.

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
  /** Test kit price for members of this plan; falls back to TEST_KIT_PRICE. */
  testKitPrice?: number;
}

export const TEST_KIT_PRICE = 699;

export const PLANS: Record<PlanKey, MembershipPlan> = {
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

export const CUSTOMER_PLANS: MembershipPlan[] = [
  PLANS.customer_basic,
  PLANS.customer_plus,
  PLANS.customer_premium,
];

export function isCustomerPlanKey(value: string): value is CustomerPlanKey {
  return CUSTOMER_PLANS.some((p) => p.key === value);
}

export function testKitPriceFor(plan: PlanKey | null): number {
  return (plan && PLANS[plan].testKitPrice) || TEST_KIT_PRICE;
}
