import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { userEmail: 'main.belkdigital@gmail.com' },
    });
    
    if (!affiliate) {
      return NextResponse.json({ error: "not found" });
    }
    
    const updated = await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: {
        status: 'suspended',
        suspendReason: 'Suspended by admin via Quick Actions'
      }
    });
    return NextResponse.json({ ok: true, updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack });
  }
}
