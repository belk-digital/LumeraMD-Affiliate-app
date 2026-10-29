// The payout rules: requests are validated and can't overspend a balance (even two at once),
// a payout only moves between sensible states, a double click acts once, marking paid updates the
// balance and the commissions it covers, and manual payouts lower the balance too. Logs emails
// instead of sending them, refuses to run against production and deletes what it makes.
//
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx --env-file=.env.local scripts/testPayouts.ts
import "dotenv/config";
delete process.env.RESEND_API_KEY;
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { updateAffiliateStats } from "../src/lib/affiliates/stats";
import { PayoutError, createManualPayout, requestPayout, updatePayout } from "../src/lib/payouts/service";

const TAG = `payout${Date.now()}`;
const say = (s: string) => process.stdout.write(`${s}\n`);
const ok = (label: string) => say(`  ✓ ${label}`);
const realLog = console.log;
const quiet = () => (console.log = () => {}); // the email stand-in prints whole messages
const loud = () => (console.log = realLog);

/** Runs a call that must be refused, and returns the refusal. */
async function refused(call: Promise<unknown>, status: number) {
  try {
    await call;
  } catch (err) {
    assert.ok(err instanceof PayoutError, `expected a PayoutError, got ${String(err)}`);
    assert.equal(err.status, status, err.message);
    return err.message;
  }
  assert.fail("expected the call to be refused");
}

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  say(`database host: ${host}`);
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");

  const affiliate = await prisma.affiliate.create({
    data: { userEmail: `${TAG}@example.test`, status: "approved", referralSlug: TAG, minimumPayoutThreshold: 50 },
  });
  const id = affiliate.id;
  const conversionIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const c = await prisma.affiliateConversion.create({
      data: {
        affiliateId: id,
        shopifyOrderId: `${TAG}-${i}`,
        attributionSource: "coupon_code",
        orderSubtotal: 100,
        eligibleSubtotal: 100,
        commissionRate: 40,
        commissionAmount: 40,
        status: "approved",
      },
    });
    conversionIds.push(c.id);
  }
  await updateAffiliateStats(id);
  const stats = () => prisma.affiliate.findUniqueOrThrow({ where: { id } });
  const notes = (type: string) => prisma.notification.count({ where: { affiliateId: id, type } });
  const conversionStatuses = async () =>
    (await prisma.affiliateConversion.findMany({ where: { id: { in: conversionIds } }, select: { status: true } })).map((c) => c.status);

  try {
    assert.equal((await stats()).totalCommissionApproved, 120);

    // ---- requests ----
    for (const bad of [Number.NaN, "abc", "", -5, 0, 1e9, null, undefined, {}]) {
      await refused(requestPayout(id, { amount: bad, payoutMethod: "PayPal" }), 400);
    }
    await refused(requestPayout(id, { amount: 60, payoutMethod: "" }), 400);
    await refused(requestPayout(id, { amount: 60, payoutMethod: 42 }), 400);
    await refused(requestPayout(id, { amount: 60, payoutMethod: "PayPal", payoutDetails: ["x"] }), 400);
    assert.match(await refused(requestPayout(id, { amount: 130, payoutMethod: "PayPal" }), 400), /exceeds available balance \(\$120\.00\)/);
    assert.match(await refused(requestPayout(id, { amount: 49, payoutMethod: "PayPal" }), 400), /Below minimum/);
    assert.equal(await prisma.affiliatePayout.count({ where: { affiliateId: id } }), 0);
    ok("a request with a bad amount, no method, an overspend or less than the minimum is refused, and nothing is created");

    quiet();
    const race = await Promise.allSettled([
      requestPayout(id, { amount: 120, payoutMethod: "PayPal", payoutDetails: { email: "a@b.c" } }),
      requestPayout(id, { amount: 120, payoutMethod: "PayPal", payoutDetails: { email: "a@b.c" } }),
      requestPayout(id, { amount: 120, payoutMethod: "PayPal", payoutDetails: { email: "a@b.c" } }),
    ]);
    loud();
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1, "exactly one of three simultaneous requests succeeds");
    assert.equal(await prisma.affiliatePayout.count({ where: { affiliateId: id, status: "pending" } }), 1);
    ok("three requests for the whole balance sent at the same moment: exactly one is accepted");

    const payout = await prisma.affiliatePayout.findFirstOrThrow({ where: { affiliateId: id } });
    assert.deepEqual([...payout.conversionIds].sort(), [...conversionIds].sort());

    // ---- approving: a double click acts once ----
    quiet();
    const approve = await Promise.allSettled([updatePayout(payout.id, { status: "approved" }), updatePayout(payout.id, { status: "approved" })]);
    loud();
    assert.ok(approve.every((r) => r.status === "fulfilled"));
    assert.equal((await prisma.affiliatePayout.findUniqueOrThrow({ where: { id: payout.id } })).status, "approved");
    assert.equal(await notes("payout_approved"), 1);
    ok("approving twice at once approves once and tells the affiliate once");

    // ---- paying: balance, commissions, a double click ----
    quiet();
    const paid = await Promise.allSettled([
      updatePayout(payout.id, { status: "paid", transactionId: "TXN-1" }),
      updatePayout(payout.id, { status: "paid", transactionId: "TXN-1" }),
    ]);
    loud();
    assert.ok(paid.every((r) => r.status === "fulfilled"));
    assert.equal(await notes("payout_paid"), 1);
    assert.deepEqual(await conversionStatuses(), ["paid", "paid", "paid"]);
    const afterPaid = await stats();
    assert.deepEqual([afterPaid.totalCommissionApproved, afterPaid.totalCommissionPaid], [0, 120]);
    ok("marking paid twice at once pays once: one email, the commissions are paid and the balance is updated");

    await refused(requestPayout(id, { amount: 50, payoutMethod: "PayPal" }), 400);
    ok("the money that was paid out can't be requested again");

    // ---- state rules ----
    await refused(updatePayout(payout.id, { status: "approved" }), 409);
    await refused(updatePayout(payout.id, { status: "rejected" }), 409);
    await refused(updatePayout(payout.id, { amount: 10 }), 409);
    await refused(updatePayout("nope", { status: "paid" }), 404);
    await refused(updatePayout(payout.id, { status: "banana" }), 400);
    const note = await updatePayout(payout.id, { transactionId: "TXN-2" });
    assert.equal(note.payout.transactionId, "TXN-2");
    ok("a paid payout can't jump to another state or change its amount, but its reference can be corrected");

    // ---- reopening ----
    quiet();
    await updatePayout(payout.id, { status: "pending" });
    loud();
    assert.deepEqual(await conversionStatuses(), ["approved", "approved", "approved"]);
    const reopened = await stats();
    assert.deepEqual([reopened.totalCommissionApproved, reopened.totalCommissionPaid], [120, 0]);
    assert.equal(await notes("payout_paid"), 1, "reopening is quiet");
    ok("reopening a paid payout puts the commissions and balance back, quietly");

    quiet();
    await updatePayout(payout.id, { status: "rejected", notes: "Wrong details" });
    loud();
    assert.equal(await notes("payout_rejected"), 1);
    await refused(updatePayout(payout.id, { status: "paid" }), 409);
    await refused(updatePayout(payout.id, { status: "approved" }), 409);
    await refused(updatePayout(payout.id, { amount: 60 }), 409);
    assert.deepEqual(await conversionStatuses(), ["approved", "approved", "approved"]);
    ok("a rejected payout can't be marked paid or approved without being reopened first");

    quiet();
    await updatePayout(payout.id, { status: "pending" });
    loud();
    await refused(updatePayout(payout.id, { amount: -3 }), 400);
    await refused(updatePayout(payout.id, { amount: "abc" }), 400);
    const edited = await updatePayout(payout.id, { amount: "100.456", payoutMethod: "Bank transfer" });
    assert.deepEqual([edited.payout.amount, edited.payout.payoutMethod], [100.46, "Bank transfer"]);
    quiet();
    await updatePayout(payout.id, { status: "paid", transactionId: "TXN-3" });
    loud();
    const final = await stats();
    assert.deepEqual([final.totalCommissionApproved, final.totalCommissionPaid], [19.54, 100.46]);
    ok("a pending payout's amount and method can be edited (rounded to cents), and paying it uses the edited amount");

    // ---- manual payouts ----
    await refused(createManualPayout({ affiliateId: id, amount: -1 }), 400);
    await refused(createManualPayout({ affiliateId: id, amount: "x" }), 400);
    await refused(createManualPayout({ affiliateId: "nobody", amount: 5 }), 404);
    await refused(createManualPayout({ affiliateId: "", amount: 5 }), 400);
    await createManualPayout({ affiliateId: id, amount: 10, notes: "Cash" });
    const manual = await stats();
    assert.deepEqual([manual.totalCommissionApproved, manual.totalCommissionPaid], [9.54, 110.46]);
    ok("a manual payout is validated and lowers the balance straight away");

    say("\nAll payout checks passed.");
  } finally {
    loud();
    await prisma.notification.deleteMany({ where: { affiliateId: id } });
    await prisma.affiliatePayout.deleteMany({ where: { affiliateId: id } });
    await prisma.affiliateConversion.deleteMany({ where: { affiliateId: id } });
    await prisma.affiliate.deleteMany({ where: { id } });
  }
}

main()
  .catch((err) => {
    console.error("\nFAILED:", err instanceof Error ? (err.stack ?? err.message) : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
