import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { getWalletSummary, WalletError } from "@/lib/wallet/ledger";
import { toCents } from "@/lib/wallet/rules";
import { adjustWallet } from "@/lib/wallet/service";

const EMAIL_OK = (e: unknown): e is string => typeof e === "string" && e.includes("@") && e.length <= 254;

// A member's wallet for the admin: balance and recent ledger entries.
export async function GET(req: NextRequest) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const email = req.nextUrl.searchParams.get("email");
  if (!EMAIL_OK(email)) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const summary = await getWalletSummary("customer", email, 25);
  return NextResponse.json({
    balanceCents: summary.balanceCents,
    pendingCodes: summary.pendingRedemptions.length,
    transactions: summary.transactions.map((t) => ({
      id: t.id,
      createdAt: t.createdAt.toISOString(),
      type: t.type,
      reason: t.reason,
      amountCents: t.amountCents,
      balanceAfterCents: t.balanceAfterCents,
      createdBy: t.createdBy,
    })),
  });
}

// Add or remove points by hand. Always needs a reason, is recorded with the admin's email, and
// can't take a balance below zero.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAdminOrResponse();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const points = Number(body.points);
  if (!EMAIL_OK(body.email)) return NextResponse.json({ error: "email is required" }, { status: 400 });
  if (!Number.isFinite(points) || points === 0 || Math.abs(points) > 100_000) {
    return NextResponse.json(
      { error: "Enter an amount other than zero (use a minus sign to remove points)." },
      { status: 400 },
    );
  }

  try {
    const result = await adjustWallet({
      email: body.email,
      amountCents: toCents(points),
      reason: typeof body.reason === "string" ? body.reason : "",
      adminEmail: session.email,
    });
    return NextResponse.json({ ok: true, balanceCents: result.balanceCents });
  } catch (err) {
    if (err instanceof WalletError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("Wallet adjustment failed", err);
    return NextResponse.json({ error: "Could not adjust the wallet." }, { status: 500 });
  }
}
