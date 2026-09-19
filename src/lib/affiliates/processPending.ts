import { prisma } from "@/lib/prisma";
import { updateAffiliateStats } from "@/lib/affiliates/stats";
import { createNotification } from "@/lib/notifications/create";

export async function processPendingConversions() {
  const due = await prisma.affiliateConversion.findMany({
    where: { status: "pending", pendingUntil: { lte: new Date() } },
  });

  const affiliateIds = new Set<string>();
  const maturedByAffiliate = new Map<string, { count: number; total: number }>();

  for (const conversion of due) {
    await prisma.affiliateConversion.update({
      where: { id: conversion.id },
      data: { status: "approved" },
    });
    affiliateIds.add(conversion.affiliateId);
    if (conversion.parentAffiliateId) {
      affiliateIds.add(conversion.parentAffiliateId);
    }

    const tally = maturedByAffiliate.get(conversion.affiliateId) ?? { count: 0, total: 0 };
    tally.count += 1;
    tally.total += conversion.commissionAmount;
    maturedByAffiliate.set(conversion.affiliateId, tally);
  }

  for (const affiliateId of affiliateIds) {
    await updateAffiliateStats(affiliateId);
  }

  for (const [affiliateId, { count, total }] of maturedByAffiliate) {
    await createNotification(affiliateId, {
      type: "commission_approved",
      title: `$${total.toFixed(2)} is now available`,
      body: `${count} commission${count === 1 ? "" : "s"} cleared the pending period.`,
    });
  }

  return { matured: due.length };
}
