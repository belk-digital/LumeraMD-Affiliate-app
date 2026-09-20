import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import { ClicksClient } from "./ClicksClient";

export const dynamic = "force-dynamic";

async function getCountStatWithTrend(whereClause: any = {}, uniqueAffiliates = false) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  let total = 0;
  let current30 = 0;
  let previous30 = 0;

  if (uniqueAffiliates) {
    const [tRaw, cRaw, pRaw] = await Promise.all([
      prisma.affiliateClick.findMany({ where: whereClause, select: { affiliateId: true }, distinct: ['affiliateId'] }),
      prisma.affiliateClick.findMany({ where: { ...whereClause, createdAt: { gte: thirtyDaysAgo } }, select: { affiliateId: true }, distinct: ['affiliateId'] }),
      prisma.affiliateClick.findMany({ where: { ...whereClause, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } }, select: { affiliateId: true }, distinct: ['affiliateId'] })
    ]);
    total = tRaw.length;
    current30 = cRaw.length;
    previous30 = pRaw.length;
  } else {
    const [t, c, p] = await Promise.all([
      prisma.affiliateClick.count({ where: whereClause }),
      prisma.affiliateClick.count({ where: { ...whereClause, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.affiliateClick.count({ where: { ...whereClause, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } })
    ]);
    total = t;
    current30 = c;
    previous30 = p;
  }

  let trend = 0;
  if (previous30 === 0) {
    trend = current30 > 0 ? 100 : 0;
  } else {
    trend = Math.round(((current30 - previous30) / previous30) * 100);
  }

  return { total, trend };
}

export default async function AdminClicksPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdminPage();

  const sp = await searchParams;
  const rawQuery = sp.q;
  const q = (typeof rawQuery === "string" ? rawQuery : "").trim();
  
  const rawAffiliateId = sp.affiliateId;
  const affiliateId = typeof rawAffiliateId === "string" && rawAffiliateId !== "all" ? rawAffiliateId : undefined;
  
  const rawDevice = sp.device;
  const device = typeof rawDevice === "string" && rawDevice !== "all" ? rawDevice : undefined;
  
  const rawClickType = sp.clickType;
  const clickType = typeof rawClickType === "string" && rawClickType !== "all" ? rawClickType : undefined;

  const rawDateRange = sp.dateRange;
  const dateRange = typeof rawDateRange === "string" ? rawDateRange : "last30"; // default to last 30 as in mockup

  const rawPage = sp.page;
  const page = typeof rawPage === "string" ? parseInt(rawPage, 10) || 1 : 1;
  const pageSize = 20;

  // Build dynamic where clause based on filters
  const where: any = {};
  
  if (q) {
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { affiliate: { userEmail: { contains: q, mode: "insensitive" } } },
      { affiliate: { displayName: { contains: q, mode: "insensitive" } } },
    ];
  }
  
  if (affiliateId) {
    where.affiliateId = affiliateId;
  }
  
  if (device) {
    if (device === "desktop") where.deviceType = { not: "mobile" }; // Simplification, usually you track explicit deviceType
    if (device === "mobile") where.deviceType = "mobile";
  }

  if (clickType === "converted") where.convertedToOrder = true;
  if (clickType === "suspicious") where.isSuspicious = true;

  if (dateRange !== "all") {
    const now = new Date();
    if (dateRange === "last7") {
      where.createdAt = { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
    } else if (dateRange === "last30") {
      where.createdAt = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    } else if (dateRange === "thisMonth") {
      where.createdAt = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    }
  }

  // Fetch paginated clicks
  const clicksPromise = prisma.affiliateClick.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: { affiliate: true },
  });

  // Fetch total count for pagination
  const totalFilteredPromise = prisma.affiliateClick.count({ where });

  // Fetch summary stats
  const totalClicksPromise = getCountStatWithTrend({});
  const uniqueAffiliatesPromise = getCountStatWithTrend({}, true);
  // Assuming anything not 'mobile' is 'desktop' or we just explicitly query 'Desktop'
  const desktopClicksPromise = getCountStatWithTrend({ 
    OR: [{ deviceType: "desktop" }, { deviceType: "Desktop" }]
  });
  const clicksConvertedPromise = getCountStatWithTrend({ convertedToOrder: true });
  
  // Get all active affiliates for the filter dropdown
  const affiliatesPromise = prisma.affiliate.findMany({
    where: { status: "approved" },
    select: { id: true, displayName: true, userEmail: true },
    orderBy: { userEmail: "asc" }
  });

  const [
    clicks, 
    totalFiltered, 
    totalClicks, 
    uniqueAffiliates, 
    desktopClicks,
    clicksConverted,
    allAffiliates
  ] = await Promise.all([
    clicksPromise,
    totalFilteredPromise,
    totalClicksPromise,
    uniqueAffiliatesPromise,
    desktopClicksPromise,
    clicksConvertedPromise,
    affiliatesPromise
  ]);

  const stats = {
    totalClicks,
    uniqueAffiliates,
    desktopClicks,
    clicksConverted,
  };

  return (
    <ClicksClient 
      initialClicks={clicks} 
      totalFiltered={totalFiltered}
      page={page}
      pageSize={pageSize}
      stats={stats}
      searchQuery={q}
      currentAffiliateId={affiliateId || "all"}
      currentDevice={device || "all"}
      currentClickType={clickType || "all"}
      currentDateRange={dateRange}
      affiliates={allAffiliates}
    />
  );
}
