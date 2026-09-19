import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { updateAffiliateStats } from "../src/lib/affiliates/stats";

async function main() {
  const conversion = await prisma.affiliateConversion.findFirst({
    where: { affiliateId: "cmu620yv60000yovqhx9h1yph", status: "pending" },
  });
  if (!conversion) {
    console.log("No pending conversion found");
    return;
  }
  await prisma.affiliateConversion.update({
    where: { id: conversion.id },
    data: { status: "approved" },
  });
  await updateAffiliateStats(conversion.affiliateId);
  console.log("Approved:", conversion.id);
}

main().finally(() => prisma.$disconnect());
