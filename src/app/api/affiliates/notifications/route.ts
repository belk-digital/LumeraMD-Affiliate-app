import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasAffiliateAccess } from "@/lib/affiliates/access";

export async function GET(req: NextRequest) {
  const affiliateId = req.nextUrl.searchParams.get("affiliateId");
  if (!affiliateId || !(await hasAffiliateAccess(affiliateId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { affiliateId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.notification.count({ where: { affiliateId, readAt: null } }),
  ]);

  return NextResponse.json({ unreadCount, notifications });
}
