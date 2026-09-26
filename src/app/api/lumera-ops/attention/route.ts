import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";

export async function GET() {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const [pendingApplications, pendingPayouts, applications, payouts] = await Promise.all([
    prisma.affiliateApplication.count({ where: { status: "pending" } }),
    prisma.affiliatePayout.count({ where: { status: "pending" } }),
    prisma.affiliateApplication.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.affiliatePayout.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { affiliate: { select: { displayName: true, userEmail: true } } },
    }),
  ]);

  const items = [
    ...applications.map((a) => ({
      id: `app-${a.id}`,
      title: `${a.displayName} applied`,
      subtitle: a.email,
      createdAt: a.createdAt,
      href: "/lumera-ops/applications?status=pending",
    })),
    ...payouts.map((p) => ({
      id: `payout-${p.id}`,
      title: `${p.affiliate.displayName || p.affiliate.userEmail} requested $${p.amount.toFixed(2)}`,
      subtitle: `Payout via ${p.payoutMethod ?? "unspecified method"}`,
      createdAt: p.createdAt,
      href: "/lumera-ops/payouts",
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 8);

  return NextResponse.json({ pendingApplications, pendingPayouts, items });
}
