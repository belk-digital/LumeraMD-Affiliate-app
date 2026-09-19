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

  const data = {
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
