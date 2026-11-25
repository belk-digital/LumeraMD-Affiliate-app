// Checks moveAffiliate end to end on the testing DB: history row, pending orders recomputed, approved orders
// untouched, notices created. Needs the mock data from seedHierarchyMock.ts. Cleans up after itself.
//   RESEND_API_KEY= npx tsx --env-file=.env --env-file=.env.local scripts/testMoveHistory.ts
// (leave RESEND_API_KEY empty so no real email goes out to the mock addresses)
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { moveAffiliate, MoveError } from "../src/lib/affiliates/reassign";

async function main() {
  if (new URL(process.env.DATABASE_URL ?? "").host.includes("cold-forest")) throw new Error("Refusing to run against production.");
  if (process.env.RESEND_API_KEY) throw new Error("Run with RESEND_API_KEY empty so mock addresses aren't emailed.");

  const started = new Date();
  const mocks = await prisma.affiliate.findMany({ where: { userEmail: { endsWith: "@mock.lumera.test" } } });
  const parent = mocks.find((m) => m.status === "approved" && m.parentAffiliateId !== null && mocks.some((c) => c.parentAffiliateId === m.id && c.status === "approved"));
  assert.ok(parent, "needs mock data");
  const child = mocks.find((m) => m.parentAffiliateId === parent.id && m.status === "approved")!;
  const original = parent.parentAffiliateId;
  const tag = `mock-test-${Date.now()}`;

  const base = {
    attributionSource: "coupon_code" as const,
    orderSubtotal: 100,
    eligibleSubtotal: 100,
    commissionRate: 10,
    commissionAmount: 10,
    pendingUntil: new Date(Date.now() + 7 * 864e5),
  };
  const pending = await prisma.affiliateConversion.create({ data: { ...base, affiliateId: child.id, shopifyOrderId: `${tag}-p`, status: "pending" } });
  const approved = await prisma.affiliateConversion.create({
    data: {
      ...base,
      affiliateId: child.id,
      shopifyOrderId: `${tag}-a`,
      status: "approved",
      overrides: { create: [{ affiliateId: parent.id, level: 1, slot: 1, rate: 5, amount: 5 }] },
    },
  });

  try {
    await assert.rejects(() => moveAffiliate({ id: parent.id, parentId: child.id, adminEmail: "t@t" }), MoveError);
    assert.deepEqual(await moveAffiliate({ id: parent.id, parentId: original, adminEmail: "t@t" }), { unchanged: true });

    const r1 = await moveAffiliate({ id: parent.id, parentId: null, adminEmail: "admin@test" });
    assert.equal(r1.unchanged, false);
    assert.ok(r1.unchanged === false && r1.pendingOrdersUpdated >= 1, "pending order recomputed");
    const afterTop = await prisma.conversionOverride.findMany({ where: { conversionId: pending.id } });
    assert.ok(afterTop.every((o) => o.affiliateId === parent.id), "with the parent at the top, only they can earn on it");

    await moveAffiliate({ id: parent.id, parentId: original, adminEmail: "admin@test" });
    const approvedOverrides = await prisma.conversionOverride.findMany({ where: { conversionId: approved.id } });
    assert.equal(approvedOverrides.length, 1, "approved order keeps its overrides");
    assert.equal(approvedOverrides[0].affiliateId, parent.id);

    const history = await prisma.affiliateMove.findMany({ where: { affiliateId: parent.id, createdAt: { gte: started } }, orderBy: { createdAt: "asc" } });
    assert.equal(history.length, 2);
    assert.equal(history[0].toParentId, null);
    assert.equal(history[0].movedByEmail, "admin@test");
    assert.equal(history[1].toParentId, original);
    assert.ok(history[0].teamSize >= 1);

    const notes = await prisma.notification.count({ where: { affiliateId: parent.id, type: "team_moved", createdAt: { gte: started } } });
    assert.ok(notes >= 2, "moved affiliate was notified each time");
    console.log("all move history checks passed");
  } finally {
    await prisma.affiliate.update({ where: { id: parent.id }, data: { parentAffiliateId: original } });
    await prisma.affiliateConversion.deleteMany({ where: { shopifyOrderId: { startsWith: tag } } });
    await prisma.affiliateMove.deleteMany({ where: { createdAt: { gte: started } } });
    await prisma.notification.deleteMany({ where: { type: "team_moved", createdAt: { gte: started } } });
  }
}

main().finally(() => prisma.$disconnect());
