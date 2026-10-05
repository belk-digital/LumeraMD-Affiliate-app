// Stress-tests the wallet ledger against a real database: idempotency, no overspending under
// concurrency, floors, and the database's own non-negative guard. Refuses to run against production
// and deletes everything it creates.
//
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx scripts/testWalletLedger.ts
import "dotenv/config"; // does not override an already-exported DATABASE_URL
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { creditWallet, debitWallet, ensureWalletAccount, getWalletSummary, verifyWalletIntegrity, WalletError } from "../src/lib/wallet/ledger";

const TAG = `e2e${Date.now()}`;
const ok = (label: string) => console.log("  ✓", label);
const owner = (n: string) => `${TAG}-${n}@example.test`;

async function integrity(kind: "customer", key: string) {
  const acct = await ensureWalletAccount(kind, key);
  const res = await verifyWalletIntegrity(acct.id);
  assert.ok(res.ok, `ledger (${res.ledgerCents}) must equal balance (${res.balanceCents})`);
  return res.balanceCents;
}

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  console.log("database host:", host);
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");

  try {
    console.log("\nBasics");
    const a = owner("basic");
    const c1 = await creditWallet({ kind: "customer", ownerKey: a, amountCents: 5000, reason: "test" });
    assert.equal(c1.balanceCents, 5000);
    const d1 = await debitWallet({ kind: "customer", ownerKey: a, amountCents: 1250 });
    assert.equal(d1.balanceCents, 3750);
    assert.equal(await integrity("customer", a), 3750);
    ok("credit $50, spend $12.50 -> $37.50, and the ledger adds up to the balance");
    const upper = await creditWallet({ kind: "customer", ownerKey: a.toUpperCase(), amountCents: 100 });
    assert.equal(upper.balanceCents, 3850);
    ok("emails are matched case-insensitively (same wallet)");

    console.log("\nInvalid input");
    await assert.rejects(creditWallet({ kind: "customer", ownerKey: a, amountCents: 0 }), (e: unknown) => e instanceof WalletError && e.code === "invalid");
    await assert.rejects(creditWallet({ kind: "customer", ownerKey: a, amountCents: 1.5 }), (e: unknown) => e instanceof WalletError && e.code === "invalid");
    ok("zero and fractional cents are refused");

    console.log("\nIdempotency");
    const k = owner("idem");
    const first = await creditWallet({ kind: "customer", ownerKey: k, amountCents: 1000, idempotencyKey: `${TAG}-k1` });
    const second = await creditWallet({ kind: "customer", ownerKey: k, amountCents: 1000, idempotencyKey: `${TAG}-k1` });
    assert.equal(first.applied, true);
    assert.equal(second.duplicate, true);
    assert.equal(second.balanceCents, 1000);
    ok("the same key twice credits once");

    console.log("\nOverspending");
    const o = owner("over");
    await creditWallet({ kind: "customer", ownerKey: o, amountCents: 1000 });
    await assert.rejects(debitWallet({ kind: "customer", ownerKey: o, amountCents: 1001 }), (e: unknown) => e instanceof WalletError && e.code === "insufficient");
    assert.equal(await integrity("customer", o), 1000);
    ok("spending more than the balance is refused and changes nothing");

    console.log("\nClawback floors at zero");
    const f = owner("floor");
    await creditWallet({ kind: "customer", ownerKey: f, amountCents: 700 });
    const claw = await debitWallet({ kind: "customer", ownerKey: f, amountCents: 1000, type: "clawback", allowPartial: true });
    assert.equal(claw.appliedCents, -700);
    assert.equal(claw.balanceCents, 0);
    const again = await debitWallet({ kind: "customer", ownerKey: f, amountCents: 1000, type: "clawback", allowPartial: true });
    assert.equal(again.applied, false);
    assert.equal(await integrity("customer", f), 0);
    ok("asking for $10 back from a $7 balance takes $7, then nothing; never negative");

    console.log("\nConcurrency");
    const r = owner("race");
    await creditWallet({ kind: "customer", ownerKey: r, amountCents: 2000 });
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => debitWallet({ kind: "customer", ownerKey: r, amountCents: 300 })),
    );
    const succeeded = results.filter((x) => x.status === "fulfilled").length;
    const refused = results.filter((x) => x.status === "rejected" && (x.reason as WalletError).code === "insufficient").length;
    assert.equal(succeeded, 6);
    assert.equal(refused, 4);
    assert.equal(await integrity("customer", r), 200);
    ok("10 simultaneous $3 spends against $20: exactly 6 succeed, 4 refused, $2.00 left");

    const dup = owner("dupe");
    const dupResults = await Promise.all(
      Array.from({ length: 8 }, () => creditWallet({ kind: "customer", ownerKey: dup, amountCents: 500, idempotencyKey: `${TAG}-same` })),
    );
    assert.equal(dupResults.filter((x) => x.applied).length, 1);
    assert.equal(await integrity("customer", dup), 500);
    ok("8 simultaneous credits with the same key: credited exactly once");

    const fresh = owner("fresh");
    const freshResults = await Promise.all(
      Array.from({ length: 6 }, (_, i) => creditWallet({ kind: "customer", ownerKey: fresh, amountCents: 100, idempotencyKey: `${TAG}-fresh-${i}` })),
    );
    assert.equal(freshResults.every((x) => x.applied), true);
    assert.equal(await integrity("customer", fresh), 600);
    assert.equal(await prisma.walletAccount.count({ where: { ownerKey: fresh.toLowerCase() } }), 1);
    ok("6 simultaneous first-ever credits create one account and all land ($6.00)");

    console.log("\nDatabase guard");
    const acct = await ensureWalletAccount("customer", owner("guard"));
    await assert.rejects(
      prisma.$executeRaw`UPDATE "wallet_accounts" SET "balanceCents" = -1 WHERE "id" = ${acct.id}`,
      /wallet_accounts_balance_nonnegative|check constraint/i,
    );
    ok("even a direct SQL update can't push a balance below zero");

    console.log("\nSummary");
    const sum = await getWalletSummary("customer", a);
    assert.equal(sum.balanceCents, 3850);
    assert.equal(sum.transactions.length, 3);
    assert.equal(sum.transactions[0].amountCents, 100);
    ok("history comes back newest first");

    console.log("\nALL CHECKS PASSED");
  } finally {
    const n = await prisma.walletAccount.deleteMany({ where: { ownerKey: { startsWith: TAG } } });
    console.log(`\ncleaned up ${n.count} test wallets`);
  }
}

main()
  .catch((e) => {
    console.error("\nFAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
