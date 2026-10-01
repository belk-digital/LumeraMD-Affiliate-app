import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { downloadFile } from "@/lib/storage";

/** Streams a sales rep's uploaded resume. Admin-only; the file never reaches client-side props. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;
  const signup = await prisma.salesRepSignup.findUnique({
    where: { id },
    select: { resumeStorageKey: true, resumeFileType: true, resumeFileName: true },
  });

  if (!signup?.resumeStorageKey) {
    return NextResponse.json({ error: "No resume on file for this signup." }, { status: 404 });
  }

  const file = await downloadFile(signup.resumeStorageKey);
  if (!file) {
    return NextResponse.json({ error: "Couldn't retrieve the resume file." }, { status: 502 });
  }

  const fileName = (signup.resumeFileName || "resume.pdf").replace(/["\r\n]/g, "");

  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType || signup.resumeFileType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
