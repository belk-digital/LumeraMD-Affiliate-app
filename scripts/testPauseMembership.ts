// Pause / activate / complimentary on a membership, against a real database. Never calls Shopify or
// Authorize.net (skipShopify, and the test members have no card subscription), sends no email (the mail
// layer logs instead), refuses to run against production and deletes what it creates.
//
//   RESEND_API_KEY= pnpm dlx tsx --env-file=.env --env-file=.env.local scripts/testPauseMembership.ts
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  MembershipError,
  activateMembership,
  grantComplimentary,
  pauseMembership,
  sendPaymentLink,
} from "../src/lib/membership/lifecycle";

const TAG = `pz${Date.now()}`;
const ok = (label: string) => console.log("  ✓", label);
const skip = { skipShopify: true };

async function rejects(p: Promise<unknown>, status: number, re: RegExp) {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof MembershipError, String(e));
    assert.equal(e.status, status);
    assert.match(e.message, re);
    return;
  }
  assert.fail("expected a MembershipError");
}

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "").host;
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");
  delete process.env.RESEND_API_KEY;

  const future = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
  const make = (n: string, data: Record<string, unknown> = {}) =>
    prisma.customerSignup.create({
      data: {
        firstName: "Test",
        lastName: n,
        email: `${TAG}-${n}@example.test`,
        plan: "customer_plus",
        status: "active",
        activatedAt: new Date(),
        currentPeriodEnd: future,
        memberDiscountCode: `MEMBER-${TAG}${n}`.toUpperCase().slice(0, 20),
        memberDiscountActive: true,
        ...data,
      },
    });

  const paid = await make("paid");
  const unpaid = await make("unpaid", { status: "pending_payment", memberDiscountActive: false, memberDiscountCode: null, activatedAt: null });
  try {
    console.log("\nPause");
    await rejects(pauseMembership(unpaid.id, skip), 409, /not started/);
    ok("a membership that never started cannot be paused");
    const p = await pauseMembership(paid.id, skip);
    assert.equal(p.customer.status, "paused");
    assert.equal(p.customer.memberDiscountActive, false);
    assert.equal(p.customer.currentPeriodEnd?.getTime(), future.getTime());
    ok("paused: discount withdrawn, paid-through date kept");
    await rejects(pauseMembership(paid.id, skip), 409, /already paused/);
    ok("pausing twice is refused");

    console.log("\nActivate");
    await rejects(activateMembership(unpaid.id, skip), 409, /Only a paused/);
    ok("only a paused membership can be activated");
    const a = await activateMembership(paid.id, skip);
    assert.equal(a.customer.status, "active");
    assert.equal(a.customer.memberDiscountActive, true);
    ok("activated while the period is still paid: active again, discount back");

    console.log("\nPeriod ran out while paused");
    await pauseMembership(paid.id, skip);
    await prisma.customerSignup.update({ where: { id: paid.id }, data: { currentPeriodEnd: new Date(Date.now() - 86400000) } });
    await rejects(activateMembership(paid.id, skip), 409, /paid period ended/);
    ok("not switched on for free: the admin is told to send the pay link or make it complimentary");

    console.log("\nPayment link");
    const live = await make("live", { memberDiscountCode: null, memberDiscountActive: false });
    await rejects(sendPaymentLink(live.id), 409, /already active/);
    ok("an active membership has nothing to pay");
    await prisma.customerSignup.update({ where: { id: paid.id }, data: { status: "paused", currentPeriodEnd: future } });
    await rejects(sendPaymentLink(paid.id), 409, /paid up/);
    ok("a paused membership that is still paid is told to use Activate instead");
    await prisma.customerSignup.update({ where: { id: paid.id }, data: { currentPeriodEnd: new Date(Date.now() - 86400000) } });
    try {
      const sent = await sendPaymentLink(paid.id);
      assert.match(sent.link, /\/pay\//);
      ok("a paused, lapsed membership is emailed its payment link");
    } catch (e) {
      assert.ok(e instanceof MembershipError && /not set up/.test(e.message), String(e));
      ok("online payment is not configured here, so it is refused with a clear message");
    }

    console.log("\nComplimentary");
    const c = await grantComplimentary(paid.id, { note: "test", adminEmail: "admin@example.test" }, skip);
    assert.equal(c.customer.status, "active");
    assert.equal(c.customer.complimentary, true);
    assert.equal(c.customer.currentPeriodEnd, null);
    ok("a paused, lapsed membership can be made complimentary: active, free, no end date");
    const p2 = await pauseMembership(paid.id, skip);
    assert.equal(p2.customer.complimentary, true);
    const a2 = await activateMembership(paid.id, skip);
    assert.equal(a2.customer.status, "active");
    ok("a complimentary membership can be paused and switched back on without any payment");
    console.log("\nall passed");
  } finally {
    await prisma.customerSignup.deleteMany({ where: { email: { startsWith: TAG } } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
