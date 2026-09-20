import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import { AffiliatesClient } from "./AffiliatesClient";

export const dynamic = "force-dynamic";

async function getStatWithTrend(whereClause: any = {}) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const total = await prisma.affiliate.count({ where: whereClause });
  
  const current30 = await prisma.affiliate.count({
    where: { ...whereClause, createdAt: { gte: thirtyDaysAgo } }
  });
  
  const previous30 = await prisma.affiliate.count({
    where: { ...whereClause, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } }
  });

  let trend = 0;
  if (previous30 === 0) {
    trend = current30 > 0 ? 100 : 0;
  } else {
    trend = Math.round(((current30 - previous30) / previous30) * 100);
  }

  return { total, trend };
}

export default async function AdminAffiliatesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdminPage();

  const sp = await searchParams;
  const rawQuery = sp.q;
  const q = (typeof rawQuery === "string" ? rawQuery : "").trim();
  
  const rawStatus = sp.status;
  const status = typeof rawStatus === "string" && rawStatus !== "all" ? rawStatus : undefined;
  
  const rawParent = sp.parent;
  const parentId = typeof rawParent === "string" && rawParent !== "all" ? rawParent : undefined;

  const rawPage = sp.page;
  const page = typeof rawPage === "string" ? parseInt(rawPage, 10) || 1 : 1;
  const pageSize = 20;

  // Build the dynamic where clause based on filters
  const where: any = {};
  
  if (q) {
    where.OR = [
      { userEmail: { contains: q, mode: "insensitive" } },
      { displayName: { contains: q, mode: "insensitive" } },
      { referralSlug: { contains: q, mode: "insensitive" } },
      { shopifyDiscountCode: { contains: q, mode: "insensitive" } },
      { id: q },
    ];
  }
  
  if (status) {
    where.status = status;
  }
  
  if (parentId) {
    where.parentAffiliateId = parentId;
  }

  // Fetch paginated affiliates
  const affiliatesPromise = prisma.affiliate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  // Fetch total count for pagination
  const totalFilteredPromise = prisma.affiliate.count({ where });

  // Fetch summary stats
  const totalStatsPromise = getStatWithTrend({});
  const approvedStatsPromise = getStatWithTrend({ status: "approved" });
  const pendingStatsPromise = getStatWithTrend({ status: "pending" });
  const suspendedStatsPromise = getStatWithTrend({ status: "suspended" });

  const [
    affiliates, 
    totalFiltered, 
    totalStats, 
    approvedStats, 
    pendingStats, 
    suspendedStats
  ] = await Promise.all([
    affiliatesPromise,
    totalFilteredPromise,
    totalStatsPromise,
    approvedStatsPromise,
    pendingStatsPromise,
    suspendedStatsPromise
  ]);

  const stats = {
    total: totalStats,
    approved: approvedStats,
    pending: pendingStats,
    suspended: suspendedStats,
  };

  return (
    <AffiliatesClient 
      initialAffiliates={affiliates} 
      totalFiltered={totalFiltered}
      page={page}
      pageSize={pageSize}
      stats={stats}
      searchQuery={q}
      currentStatus={status || "all"}
      currentParent={parentId || "all"}
    />
  );
}
