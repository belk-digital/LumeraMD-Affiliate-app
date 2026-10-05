// End-to-end check of wallet points against a real database: earning from orders and memberships,
// redeeming into single-use codes, proportional refunds, expiry, and admin adjustments. Never
// touches Shopify (skipShopify) and never sends email. Refuses to run against production and
// deletes everything it creates.
//
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx scripts/testWalletService.ts
import "dotenv/config"; // does not override an already-exported DATABASE_URL
delete process.env.RESEND_API_KEY;
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { getWalletSummary, verifyWalletIntegrity, WalletError, ensureWalletAccount } from "../src/lib/wallet/ledger";
import { calculateOrderPoints, calculateMembershipPoints, refundFraction, type WalletRules } from "../src/lib/wallet/rules";
import {
  adjustWallet,
  awardMembershipPoints,
  handlePaidOrder,
  handleRefund,
  processWalletRedemptions,
  redeemPoints,
} from "../src/lib/wallet/service";

const TAG = `e2e${Date.now()}`;
const SKIP = { skipShopify: true };
const ok = (label: string) => console.log("  ✓", label);
const mail = (n: string) => `${TAG}-${n}@example.test`;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const balance = async (email: string) => (await getWalletSummary("customer", email)).balanceCents;
const integrity = async (email: string) => {
  const acct = await ensureWalletAccount("customer", email);
  const v = await verifyWalletIntegrity(acct.id);
  assert.ok(v.ok, `ledger ${v.ledgerCents} != balance ${v.balanceCents} for ${email}`);
};

async function makeMember(email: string) {
  return prisma.customerSignup.create({
    data: { firstName: "T", lastName: "Member", email, plan: "customer_plus", status: "active", activatedAt: new Date(), currentPeriodEnd: new Date(Date.now() + 20 * DAY) },
  });
}

function order(id: string, email: string | null, subtotal: number, discountTotal: number, total: number, codes: string[] = []) {
  return { id: `${TAG}-${id}`, name: `#${id}`, email, subtotal, discountTotal, total, discountCodes: codes };
}

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  console.log("database host:", host);
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");

  const before = await prisma.affiliateSettings.upsert({ where: { id: "global" }, update: {}, create: { id: "global" } });
  const setSettings = (data: Record<string, unknown>) => prisma.affiliateSettings.update({ where: { id: "global" }, data });
  await setSettings({ walletEnabled: true, walletOrderEarnPercent: 5, walletOrderMinSubtotal: 300, walletMembershipEarnPercent: 10, walletMinRedeem: 5, walletRedeemExpiryDays: 14 });

  try {
    console.log("\nEarning formula (pure)");
    const rules: WalletRules = { enabled: true, orderEarnPercent: 5, orderMinSubtotal: 300, membershipEarnPercent: 10, minRedeemCents: 500, redeemExpiryDays: 14 };
    assert.equal(calculateOrderPoints({ subtotal: 400, discountTotal: 50 }, rules).earnedCents, 1750);
    ok("$400 cart with a $50 coupon earns 5% of $350 = 17.50 points");
    const gross = calculateOrderPoints({ subtotal: 350, discountTotal: 100 }, rules);
    assert.equal(gross.earnedCents, 1250);
    ok("a $350 cart with a $100 coupon still qualifies (minimum is on the gross), earning 5% of $250");
    assert.equal(calculateOrderPoints({ subtotal: 299.99, discountTotal: 0 }, rules).reason, "below_minimum");
    assert.equal(calculateOrderPoints({ subtotal: 400, discountTotal: 0 }, { ...rules, enabled: false }).reason, "disabled");
    assert.equal(calculateOrderPoints({ subtotal: 400, discountTotal: 400 }, { ...rules, orderMinSubtotal: 0 }).reason, "zero_base");
    ok("below the minimum, disabled, and fully-discounted orders earn nothing");
    assert.equal(calculateMembershipPoints(79, rules), 790);
    assert.equal(refundFraction(50, 200), 0.25);
    assert.equal(refundFraction(null, 200), 1);
    assert.equal(refundFraction(500, 200), 1);
    ok("membership 10% of $79 = 7.90; refund share is capped at 100% and unknown means full");

    console.log("\nPaid orders");
    const a = mail("a");
    await makeMember(a);
    const o1 = await handlePaidOrder(order("o1", a, 400, 50, 380));
    assert.equal(o1.earnedCents, 1750);
    assert.equal(await balance(a), 1750);
    ok("an active member's paid order credits 17.50 points");
    const replay = await handlePaidOrder(order("o1", a, 400, 50, 380));
    assert.equal(replay.earnedCents, 0);
    assert.equal(replay.reason, "duplicate");
    assert.equal(await balance(a), 1750);
    ok("the same webhook delivered again credits nothing");
    const guest = await handlePaidOrder(order("g1", mail("guest"), 500, 0, 500));
    assert.equal(guest.reason, "not_member");
    assert.equal((await handlePaidOrder(order("g2", null, 500, 0, 500))).reason, "no_email");
    ok("guests and orders with no email earn nothing");
    await prisma.customerSignup.updateMany({ where: { email: a }, data: { status: "past_due" } });
    assert.equal((await handlePaidOrder(order("o-pd", a, 600, 0, 600))).reason, "not_member");
    await prisma.customerSignup.updateMany({ where: { email: a }, data: { status: "active" } });
    ok("a past-due member doesn't earn");
    await setSettings({ walletEnabled: false });
    assert.equal((await handlePaidOrder(order("o-off", a, 600, 0, 600))).reason, "disabled");
    await setSettings({ walletEnabled: true });
    ok("with the wallet switched off nothing is earned");

    console.log("\nMembership payments");
    const m1 = await awardMembershipPoints(a, { id: `${TAG}-pay1`, amount: 79 });
    assert.equal(m1?.appliedCents, 790);
    assert.equal((await awardMembershipPoints(a, { id: `${TAG}-pay1`, amount: 79 }))?.duplicate, true);
    assert.equal(await balance(a), 2540);
    ok("a $79 membership payment earns 7.90 points, once");

    console.log("\nRedeeming");
    await assert.rejects(redeemPoints({ email: a, amountCents: 400 }, SKIP), (e: unknown) => e instanceof WalletError && e.code === "too_small");
    await assert.rejects(redeemPoints({ email: mail("nobody"), amountCents: 1000 }, SKIP), (e: unknown) => e instanceof WalletError && e.code === "not_member");
    await assert.rejects(redeemPoints({ email: a, amountCents: 999999 }, SKIP), (e: unknown) => e instanceof WalletError && e.code === "insufficient");
    assert.equal((await getWalletSummary("customer", a)).pendingRedemptions.length, 0);
    assert.equal(await balance(a), 2540);
    ok("below the minimum, non-members and overspending are refused, leaving no stray codes or charges");
    const r1 = await redeemPoints({ email: a, amountCents: 1000 }, SKIP);
    assert.match(r1.code, /^WALLET-[A-Z2-9]{8}$/);
    assert.equal(await balance(a), 1540);
    assert.ok(r1.expiresAt.getTime() > Date.now() + 13 * DAY);
    ok(`10.00 points -> single-use code ${r1.code}, balance 15.40, valid 14 days`);
    await integrity(a);

    console.log("\nUsing the code on an order, then partial refunds");
    const o2 = await handlePaidOrder(order("o2", a, 400, 10, 390, [r1.code]));
    assert.equal(o2.redemptionUsed, true);
    assert.equal(o2.earnedCents, 1950);
    const red = await prisma.walletRedemption.findUniqueOrThrow({ where: { id: r1.id } });
    assert.equal(red.status, "used");
    assert.equal(red.usedOrderId, `${TAG}-o2`);
    assert.equal(await balance(a), 1540 + 1950);
    ok("the code is marked used; the order earns 5% of what was actually paid ($390 -> 19.50), not of the code");
    const half = await handleRefund({ orderId: `${TAG}-o2`, refundId: `${TAG}-rf1`, refundedAmount: 195 });
    assert.equal(half.clawedBackCents, 975);
    assert.equal(half.returnedCents, 500);
    ok("refunding half the order takes back half the earned points (9.75) and returns half the spent points (5.00)");
    const half2 = await handleRefund({ orderId: `${TAG}-o2`, refundId: `${TAG}-rf1`, refundedAmount: 195 });
    assert.equal(half2.clawedBackCents, 0);
    assert.equal(half2.returnedCents, 0);
    ok("the same refund delivered twice changes nothing");
    const rest = await handleRefund({ orderId: `${TAG}-o2`, refundId: `${TAG}-rf2`, refundedAmount: 390 });
    assert.equal(rest.clawedBackCents, 975);
    assert.equal(rest.returnedCents, 500);
    ok("a second, larger refund only takes/returns the remainder: never more than was earned or spent");
    assert.equal(await balance(a), 1540 + 1950 - 1950 + 1000);
    await integrity(a);

    console.log("\nClawback never leaves a debt");
    const b = mail("b");
    await makeMember(b);
    await handlePaidOrder(order("b1", b, 400, 50, 380));
    await redeemPoints({ email: b, amountCents: 1700 }, SKIP);
    assert.equal(await balance(b), 50);
    const full = await handleRefund({ orderId: `${TAG}-b1`, refundId: `${TAG}-rfb`, refundedAmount: null });
    assert.equal(full.clawedBackCents, 50);
    assert.equal(await balance(b), 0);
    await integrity(b);
    ok("earned 17.50, spent 17.00, then a full refund: takes the 0.50 that's left; balance is 0, never negative");

    console.log("\nExpiry");
    const c = mail("c");
    await makeMember(c);
    await handlePaidOrder(order("c1", c, 1000, 0, 1000)); // 50.00 points
    const x1 = await redeemPoints({ email: c, amountCents: 2000 }, SKIP);
    const x2 = await redeemPoints({ email: c, amountCents: 1000 }, SKIP);
    const x3 = await redeemPoints({ email: c, amountCents: 500 }, SKIP);
    assert.equal(await balance(c), 1500);
    await prisma.walletRedemption.update({ where: { id: x1.id }, data: { expiresAt: new Date(Date.now() - 2 * DAY) } });
    await prisma.walletRedemption.update({ where: { id: x2.id }, data: { expiresAt: new Date(Date.now() - 1 * HOUR) } });
    const run1 = await processWalletRedemptions(SKIP);
    assert.equal((await prisma.walletRedemption.findUniqueOrThrow({ where: { id: x1.id } })).status, "expired");
    assert.equal((await prisma.walletRedemption.findUniqueOrThrow({ where: { id: x2.id } })).status, "pending");
    assert.equal((await prisma.walletRedemption.findUniqueOrThrow({ where: { id: x3.id } })).status, "pending");
    assert.equal(await balance(c), 1500 + 2000);
    assert.ok(run1.expired >= 1);
    ok("a code 2 days past its deadline expires and 20.00 points return; one 1 hour past (grace window) and a live one are left alone");
    const run2 = await processWalletRedemptions(SKIP);
    assert.equal(await balance(c), 3500);
    assert.equal(run2.expired, 0);
    ok("running the job again changes nothing");
    await integrity(c);

    console.log("\nCode used after it expired");
    const late = await handlePaidOrder(order("c2", c, 100, 20, 80, [x1.code]));
    assert.equal(late.redemptionUsed, true);
    assert.equal(await balance(c), 3500 - 2000);
    ok("if the expired code is used anyway, the returned points are taken back again");
    await integrity(c);

    console.log("\nAdmin adjustments");
    await assert.rejects(adjustWallet({ email: c, amountCents: 500, reason: "  ", adminEmail: "admin@example.test" }), (e: unknown) => e instanceof WalletError && e.code === "invalid");
    await assert.rejects(adjustWallet({ email: c, amountCents: 0, reason: "x", adminEmail: "admin@example.test" }), (e: unknown) => e instanceof WalletError && e.code === "invalid");
    await assert.rejects(adjustWallet({ email: c, amountCents: -999999, reason: "too much", adminEmail: "admin@example.test" }), (e: unknown) => e instanceof WalletError && e.code === "insufficient");
    const adj = await adjustWallet({ email: c, amountCents: 500, reason: "Goodwill credit", adminEmail: "admin@example.test" });
    assert.equal(adj.balanceCents, 2000);
    assert.equal(adj.entry?.createdBy, "admin@example.test");
    assert.equal(adj.entry?.type, "adjustment");
    ok("an adjustment needs a reason, can't go below zero, and records which admin made it");

    console.log("\nALL CHECKS PASSED");
  } finally {
    await setSettings({
      walletEnabled: before.walletEnabled,
      walletOrderEarnPercent: before.walletOrderEarnPercent,
      walletOrderMinSubtotal: before.walletOrderMinSubtotal,
      walletMembershipEarnPercent: before.walletMembershipEarnPercent,
      walletMinRedeem: before.walletMinRedeem,
      walletRedeemExpiryDays: before.walletRedeemExpiryDays,
    });
    const w = await prisma.walletAccount.deleteMany({ where: { ownerKey: { startsWith: TAG } } });
    const cs = await prisma.customerSignup.deleteMany({ where: { email: { startsWith: TAG } } });
    console.log(`\ncleaned up ${w.count} wallets and ${cs.count} members; wallet settings restored (enabled=${before.walletEnabled})`);
  }
}

main()
  .catch((e) => {
    console.error("\nFAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
