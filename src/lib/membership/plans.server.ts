import { prisma } from "@/lib/prisma";
import { buildCatalog, type PlanCatalog } from "@/lib/membership/plans";

/** The membership packages as currently sold (defaults plus the admin's customizations). Server-side only. */
export async function getCatalog(): Promise<PlanCatalog> {
  const [rows, settings] = await Promise.all([
    prisma.membershipPlanConfig.findMany(),
    prisma.membershipSettings.findUnique({ where: { id: "global" } }),
  ]);
  return buildCatalog(rows, settings?.testKitPrice);
}
