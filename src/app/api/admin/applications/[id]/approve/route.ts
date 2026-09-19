import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { createAffiliateFromApplication } from "@/lib/affiliates/createFromApplication";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;

  try {
    const affiliate = await createAffiliateFromApplication(id);
    return NextResponse.json({ ok: true, affiliate });
  } catch (err) {
    console.error("Approving application failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Could not approve: ${err.message}`
            : "Could not approve this application.",
      },
      { status: 500 },
    );
  }
}
