import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { createAffiliateFromApplication } from "@/lib/affiliates/createFromApplication";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;

  const application = await prisma.affiliateApplication.findUnique({
    where: { id },
  });
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (application.w9FileName && !application.w9VerifiedAt) {
    return NextResponse.json(
      { error: "Verify the applicant's W-9 before approving." },
      { status: 400 },
    );
  }

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
