import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { downloadFile } from "@/lib/storage";

/**
 * Streams an applicant's uploaded W-9 from Neon Object Storage. Only a signed-in admin can reach
 * this route; the file bytes never touch any other page or client-side prop.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;
  const application = await prisma.affiliateApplication.findUnique({
    where: { id },
    select: { w9StorageKey: true, w9FileType: true, w9FileName: true },
  });

  if (!application?.w9StorageKey) {
    return NextResponse.json({ error: "No W-9 on file for this application." }, { status: 404 });
  }

  const file = await downloadFile(application.w9StorageKey);
  if (!file) {
    return NextResponse.json({ error: "Couldn't retrieve the W-9 file." }, { status: 502 });
  }

  const fileName = (application.w9FileName || "w9.pdf").replace(/"/g, "");

  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType || application.w9FileType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
