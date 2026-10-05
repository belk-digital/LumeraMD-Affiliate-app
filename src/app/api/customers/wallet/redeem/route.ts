import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customers/session";
import { checkRateLimit } from "@/lib/rateLimit";
import { WalletError } from "@/lib/wallet/ledger";
import { toCents } from "@/lib/wallet/rules";
import { redeemPoints } from "@/lib/wallet/service";

const STATUS_FOR: Record<WalletError["code"], number> = {
  invalid: 400,
  too_small: 400,
  insufficient: 400,
  disabled: 403,
  not_member: 403,
  shopify: 502,
};

// A signed-in member turns some of their points into a single-use discount code.
export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const customer = await prisma.customerSignup.findUnique({ where: { id: session.customerId } });
  if (!customer) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const limit = await checkRateLimit("wallet-redeem", customer.email.toLowerCase(), 10, "1 h");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many redemptions. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const points = Number(body.points);
  if (!Number.isFinite(points) || points <= 0 || points > 1_000_000) {
    return NextResponse.json({ error: "Enter how many points to redeem." }, { status: 400 });
  }

  try {
    const result = await redeemPoints({ email: customer.email, amountCents: toCents(points) });
    return NextResponse.json({
      ok: true,
      code: result.code,
      amountCents: result.amountCents,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof WalletError) {
      return NextResponse.json({ error: err.message }, { status: STATUS_FOR[err.code] });
    }
    console.error("Wallet redemption failed", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
