import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
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
