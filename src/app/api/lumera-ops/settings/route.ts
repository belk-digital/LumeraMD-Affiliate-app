import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { activityRulesFromSettings, startCyclesForExisting } from "@/lib/affiliates/activity";

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

  // Wallet points rules (only validated when the form sends them).
  let wallet: Record<string, unknown> = {};
  if ("walletEnabled" in b) {
    const earn = Number(b.walletOrderEarnPercent);
    const minOrder = Number(b.walletOrderMinSubtotal);
    const memberEarn = Number(b.walletMembershipEarnPercent);
    const minRedeem = Number(b.walletMinRedeem);
    const expiry = Number(b.walletRedeemExpiryDays);
    if (!Number.isFinite(earn) || earn < 0 || earn > 100) return bad("Points earn rate must be between 0 and 100");
    if (!Number.isFinite(minOrder) || minOrder < 0 || minOrder > 1_000_000) return bad("Minimum order must be between 0 and 1,000,000");
    if (!Number.isFinite(memberEarn) || memberEarn < 0 || memberEarn > 100) return bad("Membership points rate must be between 0 and 100");
    if (!Number.isFinite(minRedeem) || minRedeem < 0.01 || minRedeem > 10_000) return bad("Smallest redemption must be between 0.01 and 10,000 points");
    if (!Number.isInteger(expiry) || expiry < 1 || expiry > 365) return bad("Code expiry must be a whole number of days between 1 and 365");
    wallet = {
      walletEnabled: b.walletEnabled === true,
      walletOrderEarnPercent: earn,
      walletOrderMinSubtotal: minOrder,
      walletMembershipEarnPercent: memberEarn,
      walletMinRedeem: minRedeem,
      walletRedeemExpiryDays: expiry,
    };
  }

  // 90-day activity cycle (only validated when the form sends it).
  let activity: Record<string, unknown> = {};
  if ("activityEnabled" in b) {
    const days = Number(b.activityCycleDays);
    const recruits = Number(b.activityRequiredRecruits);
    const sales = Number(b.activityMinSales);
    if (!Number.isInteger(days) || days < 7 || days > 365) return bad("Cycle length must be a whole number of days between 7 and 365");
    if (!Number.isInteger(recruits) || recruits < 0 || recruits > 100) return bad("Recruits needed must be a whole number between 0 and 100");
    if (!Number.isFinite(sales) || sales < 0 || sales > 10_000_000) return bad("Sales target must be between 0 and 10,000,000");
    if (recruits === 0 && sales === 0 && b.activityEnabled === true) {
      return bad("Set recruits needed above 0 or a sales target above 0, otherwise everyone is always active");
    }
    activity = {
      activityEnabled: b.activityEnabled === true,
      activityCycleDays: days,
      activityRequiredRecruits: recruits,
      activityMinSales: sales,
    };
  }

  const previous = await prisma.affiliateSettings.findUnique({ where: { id: "global" } });

  const data = {
    ...wallet,
    ...activity,
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
    ...(typeof b.defaultCanRecruit === "boolean" ? { defaultCanRecruit: b.defaultCanRecruit } : {}),
  };

  const settings = await prisma.affiliateSettings.upsert({
    where: { id: "global" },
    update: data,
    create: { id: "global", ...data },
  });

  // Turning the program on starts a grandfathered cycle for everyone already approved, so nobody is
  // suspended on day one.
  let startedCycles = 0;
  if (settings.activityEnabled && !previous?.activityEnabled) {
    startedCycles = await startCyclesForExisting(activityRulesFromSettings(settings));
  }

  return NextResponse.json({ ok: true, settings, startedCycles });
}
