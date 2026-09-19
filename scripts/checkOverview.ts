import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { getAdminOverview } from "../src/lib/admin/overview";

async function main() {
  const o = await getAdminOverview(30);
  console.log("KPIs:", JSON.stringify(o.kpis));
  console.log("payouts:", JSON.stringify(o.payouts));
  console.log("top:", JSON.stringify(o.topRows));
  console.log("series length:", o.series.length, "| non-empty days:", o.series.filter((p) => p.conversions > 0).length);
  console.log("series totals:", JSON.stringify({
    sales: Math.round(o.series.reduce((a, p) => a + p.sales, 0) * 100) / 100,
    conversions: o.series.reduce((a, p) => a + p.conversions, 0),
    commission: Math.round(o.series.reduce((a, p) => a + p.commission, 0) * 100) / 100,
  }));

  // Independent recomputation straight from rows
  const since = new Date(); since.setDate(since.getDate() - 30);
  const convs = await prisma.affiliateConversion.findMany({ where: { createdAt: { gte: since }, status: { notIn: ["voided", "reversed"] } } });
  console.log("RAW conversions:", convs.length,
    "| revenue:", Math.round(convs.reduce((a, c) => a + c.orderSubtotal - c.orderDiscount, 0) * 100) / 100,
    "| commission:", Math.round(convs.reduce((a, c) => a + c.commissionAmount, 0) * 100) / 100);
  const owed = await prisma.affiliateConversion.findMany({ where: { status: { in: ["pending", "approved"] } } });
  console.log("RAW owed:", Math.round(owed.reduce((a, c) => a + c.commissionAmount, 0) * 100) / 100);
  console.log("RAW affiliates:", await prisma.affiliate.count(), "| pending apps:", await prisma.affiliateApplication.count({ where: { status: "pending" } }));
  const paid = await prisma.affiliatePayout.findMany({ where: { status: "paid" } });
  console.log("RAW paid payouts:", paid.map((p) => [p.amount, p.updatedAt.toISOString().slice(0, 10)]));
}
main().finally(() => prisma.$disconnect());
