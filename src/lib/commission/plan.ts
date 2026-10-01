// Unilevel compensation plan — mirrors the client's spreadsheet ("Commission Calculator" and
// "Compensation Plan Settings" tabs). Pure functions, no I/O, so the same rules can drive the
// live commission run and any what-if calculator.

export interface SellerTier {
  name: string;
  minMonthlySales: number;
  rate: number; // percent
}

export interface CompPlan {
  sellerTiers: SellerTier[]; // ascending by minMonthlySales
  overrideSlotRates: number[]; // percent per paid slot; slot 1 = first qualified upline
  requiredActiveRecruits: number;
  /** Monthly personal sales an upline needs to be paid overrides. The spreadsheet leaves this
   *  "defined by plan", so it defaults to 0 and is tuned in admin settings. */
  minPersonalSales: number;
  /** Monthly sales a recruit needs to count as "active" (0 = any approved recruit). */
  activeRecruitMinSales: number;
}

export const DEFAULT_PLAN: CompPlan = {
  sellerTiers: [
    { name: "New Sales Person", minMonthlySales: 0, rate: 10 },
    { name: "Developing Producer", minMonthlySales: 2500, rate: 15 },
    { name: "Top Seller Tier", minMonthlySales: 10000, rate: 20 },
  ],
  overrideSlotRates: [5, 3, 3, 3, 1],
  requiredActiveRecruits: 3,
  minPersonalSales: 0,
  activeRecruitMinSales: 0,
};

export interface UplineInput {
  name: string;
  qualified: boolean;
}

export interface OverrideLine {
  level: number; // 1 = the seller's direct recruiter, walking up the genealogy
  name: string;
  qualified: boolean;
  slot: number | null; // paid slot 1..N, null when compressed out
  rate: number; // percent, 0 when compressed
  amount: number;
  status: "paid" | "compressed" | "unpaid";
}

export interface CommissionResult {
  sellerTier: SellerTier;
  sellerRate: number;
  sellerCommission: number;
  overrides: OverrideLine[];
  totalOverrides: number;
  companyRetained: number; // unfilled override slots stay with the company
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function sellerTierFor(monthlySales: number, plan: CompPlan = DEFAULT_PLAN): SellerTier {
  let tier = plan.sellerTiers[0];
  for (const t of plan.sellerTiers) {
    if (monthlySales >= t.minMonthlySales) tier = t;
  }
  return tier;
}

/** Whether an upline meets this month's requirements to be paid an override. */
export function isQualified(
  params: { activeRecruits: number; personalSales: number },
  plan: CompPlan = DEFAULT_PLAN,
): boolean {
  return (
    params.personalSales >= plan.minPersonalSales &&
    params.activeRecruits >= plan.requiredActiveRecruits
  );
}

/**
 * Seller commission plus the compressed override waterfall for one transaction.
 * `uplines` is ordered nearest-first (level 1 = direct recruiter) with no depth limit. Qualified
 * uplines fill paid slots in order; unqualified ones are skipped (compressed) and earn $0.
 * Each person holds at most one slot. Slots nobody fills stay with the company.
 */
export function calculateCommission(
  params: { monthlySales: number; transactionAmount: number; uplines: UplineInput[] },
  plan: CompPlan = DEFAULT_PLAN,
): CommissionResult {
  const { monthlySales, transactionAmount, uplines } = params;
  const sellerTier = sellerTierFor(monthlySales, plan);
  const sellerCommission = round2((transactionAmount * sellerTier.rate) / 100);

  let nextSlot = 0;
  const overrides: OverrideLine[] = uplines.map((upline, i) => {
    const level = i + 1;
    if (!upline.qualified) {
      return { level, name: upline.name, qualified: false, slot: null, rate: 0, amount: 0, status: "compressed" };
    }
    if (nextSlot >= plan.overrideSlotRates.length) {
      return { level, name: upline.name, qualified: true, slot: null, rate: 0, amount: 0, status: "unpaid" };
    }
    const rate = plan.overrideSlotRates[nextSlot];
    nextSlot += 1;
    return {
      level,
      name: upline.name,
      qualified: true,
      slot: nextSlot,
      rate,
      amount: round2((transactionAmount * rate) / 100),
      status: "paid",
    };
  });

  const totalOverrides = round2(overrides.reduce((sum, o) => sum + o.amount, 0));
  const poolRate = plan.overrideSlotRates.reduce((sum, r) => sum + r, 0);
  const companyRetained = round2((transactionAmount * poolRate) / 100 - totalOverrides);

  return {
    sellerTier,
    sellerRate: sellerTier.rate,
    sellerCommission,
    overrides,
    totalOverrides,
    companyRetained,
  };
}
