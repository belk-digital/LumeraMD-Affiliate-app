import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";

const COMMISSION_TYPES = ["percent", "fixed"];
const COMMISSION_BASES = ["subtotal_before_coupon", "subtotal_after_coupon"];

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const b = await req.json().catch(() => ({}));

  if (!COMMISSION_TYPES.includes(b.defaultCommissionType)) return bad("Invalid commission type");
  if (!COMMISSION_BASES.includes(b.defaultCommissionOn)) return bad("Invalid commission base");

  const rate = Number(b.defaultCommissionRate);
  const maxRate = b.defaultCommissionType === "percent" ? 100 : 10_000;
  if (!Number.isFinite(rate) || rate < 0 || rate > maxRate) {
    return bad(`Commission must be between 0 and ${maxRate}`);
  }

  const cookieDays = Number(b.defaultCookieDurationDays);
  if (!Number.isInteger(cookieDays) || cookieDays < 1 || cookieDays > 365) {
    return bad("Cookie duration must be a whole number of days between 1 and 365");
  }

  const pendingDays = Number(b.defaultPendingPeriodDays);
  if (!Number.isInteger(pendingDays) || pendingDays < 0 || pendingDays > 365) {
    return bad("Pending period must be a whole number of days between 0 and 365");
  }

  const minimum = Number(b.defaultMinimumPayoutThreshold);
  if (!Number.isFinite(minimum) || minimum < 0 || minimum > 100_000) {
    return bad("Minimum payout must be between 0 and 100000");
  }

  const override = Number(b.defaultParentOverrideRate);
  if (!Number.isFinite(override) || override < 0 || override > 100) {
    return bad("Team override must be between 0 and 100");
  }

  const minPersonal = Number(b.unilevelMinPersonalSales);
  if (!Number.isFinite(minPersonal) || minPersonal < 0 || minPersonal > 10_000_000) {
    return bad("Personal sales requirement must be between 0 and 10,000,000");
  }
  const requiredRecruits = Number(b.unilevelRequiredRecruits);
  if (!Number.isInteger(requiredRecruits) || requiredRecruits < 0 || requiredRecruits > 100) {
    return bad("Required recruits must be a whole number between 0 and 100");
  }
  const activeMin = Number(b.unilevelActiveRecruitMinSales);
  if (!Number.isFinite(activeMin) || activeMin < 0 || activeMin > 10_000_000) {
    return bad("Active recruit sales must be between 0 and 10,000,000");
  }
  const slotRates: number[] = Array.isArray(b.unilevelSlotRates) ? b.unilevelSlotRates.map(Number) : [];
  if (slotRates.length !== 5 || slotRates.some((r) => !Number.isFinite(r) || r < 0 || r > 100)) {
    return bad("Enter all five override rates, each between 0 and 100");
  }
  if (slotRates.reduce((a, r) => a + r, 0) > 100) return bad("Override rates can't add up to more than 100%");

  const rawTiers: unknown[] = Array.isArray(b.unilevelSellerTiers) ? b.unilevelSellerTiers : [];
  const tiers = rawTiers.map((t) => {
    const x = (t ?? {}) as Record<string, unknown>;
    return {
      name: typeof x.name === "string" ? x.name.slice(0, 60) : "",
      minMonthlySales: Number(x.minMonthlySales),
      rate: Number(x.rate),
    };
  });
  if (
    tiers.length !== 3 ||
    tiers.some((t) => !t.name || !Number.isFinite(t.minMonthlySales) || t.minMonthlySales < 0) ||
    tiers.some((t) => !Number.isFinite(t.rate) || t.rate < 0 || t.rate > 100) ||
    tiers[0].minMonthlySales !== 0 ||
    tiers.some((t, i) => i > 0 && t.minMonthlySales <= tiers[i - 1].minMonthlySales)
  ) {
    return bad("Seller tiers must start at $0 and have increasing sales thresholds and rates from 0 to 100");
  }

  const data = {
    unilevelEnabled: b.unilevelEnabled === true,
    membershipCommissionEnabled: b.membershipCommissionEnabled === true,
    unilevelMinPersonalSales: minPersonal,
    unilevelRequiredRecruits: requiredRecruits,
    unilevelActiveRecruitMinSales: activeMin,
    unilevelSlotRates: slotRates,
    unilevelSellerTiers: tiers,
    defaultCommissionRate: rate,
    defaultCommissionType: b.defaultCommissionType,
    defaultCommissionOn: b.defaultCommissionOn,
    defaultCookieDurationDays: cookieDays,
    defaultPendingPeriodDays: pendingDays,
    defaultMinimumPayoutThreshold: minimum,
    defaultParentOverrideRate: override,
  };

  const settings = await prisma.affiliateSettings.upsert({
    where: { id: "global" },
    update: data,
    create: { id: "global", ...data },
  });

  return NextResponse.json({ ok: true, settings });
}
