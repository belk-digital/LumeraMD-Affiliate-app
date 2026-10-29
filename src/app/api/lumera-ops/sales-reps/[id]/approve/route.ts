import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { prisma } from "@/lib/prisma";
import { notifyRepPaymentDue } from "@/lib/email/membership";
import {
  createAffiliateFromSalesRepSignup,
  SalesRepApprovalError,
} from "@/lib/affiliates/createFromSalesRep";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;

  try {
    const affiliate = await createAffiliateFromSalesRepSignup(id);

    // Approval created the rep's unpaid Premium membership; tell them how to pay for it.
    try {
      const membership = await prisma.customerSignup.findFirst({
        where: { email: { equals: affiliate.userEmail, mode: "insensitive" }, plan: "agent", status: "pending_payment" },
      });
      if (membership) await notifyRepPaymentDue(membership);
    } catch (err) {
      console.error("Rep payment email failed", err);
    }

    return NextResponse.json({ ok: true, affiliateId: affiliate.id });
  } catch (err) {
    if (err instanceof SalesRepApprovalError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Approving sales rep signup failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? `Could not approve: ${err.message}` : "Could not approve this signup." },
      { status: 500 },
    );
  }
}
