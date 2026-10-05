// Helpers for manual testing against the TESTING database. They exist because a real Shopify order
// or a month passing can't be produced by clicking around the app.
//
//   pnpm dlx tsx scripts/devTools.ts order <referral-slug> <amount> [--approve]
//       Simulates a Shopify order credited to that affiliate, going through the real commission
//       engine (tier rate, overrides, notifications). --approve skips the pending period so the
//       money shows as available.
//   pnpm dlx tsx scripts/devTools.ts clear-orders
//       Deletes every order created by the "order" command and recalculates the balances.
//   pnpm dlx tsx scripts/devTools.ts expire <customer-email>
//       Backdates a member's paid-through date by 10 days. Run the cron job afterwards to see them
//       turn "past due" (see the manual testing guide).
//
// Wallet points (a member is any email with an active membership):
//   member <email> [basic|plus|premium]   Creates an active test member (no payment needed).
//   customer-login <email>                Prints a one-time login link for /account (no email needed).
//   wallet-order <email> <subtotal> [--discount N] [--code WALLET-XXXX] [--total N]
//       Simulates a paid Shopify order: marks a wallet code used and awards points, exactly like
//       the real "order paid" webhook. Prints the order id so you can refund it.
//   wallet-refund <orderId> <amount|full>  Simulates a Shopify refund of that order.
//   wallet-expire <email>                  Backdates that member's unused codes past their deadline
//       and runs the expiry job, so the points come back.
//   wallet-show <email>                    Balance, ledger and codes.
//   wallet-reset <email>                   Deletes that email's wallet (and its test member).
//
// Refuses to run against production, never calls Shopify, and never sends real email.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
delete process.env.RESEND_API_KEY;
process.env.SKIP_SHOPIFY = "true";

const [command, ...args] = process.argv.slice(2);

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");
  console.log("database:", host);
  const { prisma } = await import("../src/lib/prisma");
  try {
    if (command === "order") {
      const [slug, amountRaw] = args;
      const amount = Number(amountRaw);
      if (!slug || !Number.isFinite(amount) || amount <= 0) throw new Error("Usage: order <referral-slug> <amount> [--approve]");
      const affiliate = await prisma.affiliate.findUnique({ where: { referralSlug: slug } });
      if (!affiliate) throw new Error(`No affiliate with referral slug "${slug}".`);

      const { attributeOrder } = await import("../src/lib/affiliates/commission");
      const { updateStatsForConversion } = await import("../src/lib/affiliates/stats");
      const id = `DEV-${Date.now()}`;
      const conv = await attributeOrder({
        order: { id, name: `#${id.slice(-6)}`, subtotalPrice: amount, totalDiscounts: 0, discountCodes: [], customerEmail: "dev-buyer@example.test" },
        cookieAffiliateId: affiliate.id,
        cookieClickId: null,
      });
      if (!conv) throw new Error("The order wasn't attributed (is the affiliate approved?).");
      if (args.includes("--approve")) {
        await prisma.affiliateConversion.update({ where: { id: conv.id }, data: { status: "approved" } });
        await updateStatsForConversion(conv);
      }
      const overrides = await prisma.conversionOverride.findMany({
        where: { conversionId: conv.id },
        orderBy: { slot: "asc" },
        include: { affiliate: { select: { displayName: true, userEmail: true } } },
      });
      console.log(`\nOrder ${conv.shopifyOrderName}: $${amount} for ${affiliate.displayName ?? affiliate.userEmail}`);
      console.log(`  seller commission: $${conv.commissionAmount} at ${conv.commissionRate}%`);
      if (conv.parentCommissionAmount) console.log(`  legacy team override: $${conv.parentCommissionAmount} (${conv.parentCommissionRate}%)`);
      for (const o of overrides) {
        console.log(`  slot ${o.slot} (${o.rate}%): $${o.amount} -> ${o.affiliate.displayName ?? o.affiliate.userEmail} (level ${o.level})`);
      }
      if (overrides.length === 0 && !conv.parentCommissionAmount) console.log("  no overrides paid (no qualified uplines, or the unilevel plan is off)");
      console.log(`  status: ${args.includes("--approve") ? "approved (available)" : conv.status}`);
    } else if (command === "clear-orders") {
      const { updateAffiliateStats } = await import("../src/lib/affiliates/stats");
      const convs = await prisma.affiliateConversion.findMany({
        where: { shopifyOrderId: { startsWith: "DEV-" } },
        include: { overrides: { select: { affiliateId: true } } },
      });
      const ids = new Set<string>();
      for (const c of convs) {
        ids.add(c.affiliateId);
        if (c.parentAffiliateId) ids.add(c.parentAffiliateId);
        c.overrides.forEach((o) => ids.add(o.affiliateId));
      }
      await prisma.affiliateConversion.deleteMany({ where: { id: { in: convs.map((c) => c.id) } } });
      for (const id of ids) await updateAffiliateStats(id);
      console.log(`Deleted ${convs.length} dev order(s); refreshed ${ids.size} affiliate balance(s).`);
    } else if (command === "expire") {
      const [email] = args;
      if (!email) throw new Error("Usage: expire <customer-email>");
      const customer = await prisma.customerSignup.findFirst({
        where: { email: { equals: email, mode: "insensitive" }, status: "active" },
        orderBy: { createdAt: "desc" },
      });
      if (!customer) throw new Error(`No active member with email ${email}.`);
      await prisma.customerSignup.update({
        where: { id: customer.id },
        data: { currentPeriodEnd: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
      });
      console.log(`${customer.email}: paid-through date moved 10 days into the past. Run the cron job to mark them past due.`);
    } else if (command === "member") {
      const [email, planArg = "plus"] = args;
      if (!email || !email.includes("@")) throw new Error("Usage: member <email> [basic|plus|premium]");
      const plan = `customer_${planArg}`;
      if (!["customer_basic", "customer_plus", "customer_premium"].includes(plan)) throw new Error("Plan must be basic, plus or premium.");
      const existing = await prisma.customerSignup.findFirst({ where: { email: { equals: email, mode: "insensitive" }, status: { not: "cancelled" } } });
      if (existing) throw new Error(`${email} already has a membership (${existing.status}).`);
      await prisma.customerSignup.create({
        data: { firstName: "Test", lastName: "Member", email, plan, status: "active", activatedAt: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      });
      console.log(`Created an active ${planArg} member: ${email}`);
    } else if (command === "customer-login") {
      const [email] = args;
      if (!email) throw new Error("Usage: customer-login <email>");
      const member = await prisma.customerSignup.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, orderBy: { createdAt: "desc" } });
      if (!member) throw new Error(`No member with email ${email}.`);
      const token = (await import("node:crypto")).randomBytes(32).toString("hex");
      await prisma.customerLoginToken.create({ data: { customerId: member.id, token, expiresAt: new Date(Date.now() + 15 * 60 * 1000) } });
      console.log(`Open this within 15 minutes:\nhttp://localhost:3000/api/customers/auth/callback?token=${token}`);
    } else if (command === "wallet-order") {
      const [email, subtotalRaw] = args;
      const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
      const subtotal = Number(subtotalRaw);
      if (!email || !Number.isFinite(subtotal) || subtotal <= 0) throw new Error("Usage: wallet-order <email> <subtotal> [--discount N] [--code WALLET-XXXX] [--total N]");
      const discount = Number(flag("--discount") ?? 0) || 0;
      const code = flag("--code");
      const total = Number(flag("--total") ?? subtotal - discount) || subtotal - discount;
      const { handlePaidOrder } = await import("../src/lib/wallet/service");
      const { getWalletSummary } = await import("../src/lib/wallet/ledger");
      const id = `DEVW-${Date.now()}`;
      const result = await handlePaidOrder({ id, name: `#${id.slice(-6)}`, email, subtotal, discountTotal: discount, total, discountCodes: code ? [code] : [] });
      const sum = await getWalletSummary("customer", email, 1);
      console.log(`\nOrder ${id}: subtotal $${subtotal}, discount $${discount}, total $${total}${code ? `, code ${code}` : ""}`);
      console.log(`  code marked used: ${result.redemptionUsed}`);
      console.log(`  points earned: ${(result.earnedCents / 100).toFixed(2)} (${result.reason})`);
      console.log(`  balance now: ${(sum.balanceCents / 100).toFixed(2)}`);
      console.log(`  to refund it: wallet-refund ${id} <amount|full>`);
    } else if (command === "wallet-refund") {
      const [orderId, amountRaw] = args;
      if (!orderId || !amountRaw) throw new Error("Usage: wallet-refund <orderId> <amount|full>");
      const refundedAmount = amountRaw === "full" ? null : Number(amountRaw);
      if (refundedAmount !== null && !(refundedAmount > 0)) throw new Error("Amount must be a positive number, or \"full\".");
      const { handleRefund } = await import("../src/lib/wallet/service");
      const r = await handleRefund({ orderId, refundId: `DEVR-${Date.now()}`, refundedAmount });
      console.log(`Refund on ${orderId} (${amountRaw}): points taken back ${(r.clawedBackCents / 100).toFixed(2)}, points returned ${(r.returnedCents / 100).toFixed(2)}`);
    } else if (command === "wallet-expire") {
      const [email] = args;
      if (!email) throw new Error("Usage: wallet-expire <email>");
      const account = await prisma.walletAccount.findUnique({ where: { kind_ownerKey: { kind: "customer", ownerKey: email.trim().toLowerCase() } } });
      if (!account) throw new Error(`No wallet for ${email}.`);
      const moved = await prisma.walletRedemption.updateMany({ where: { accountId: account.id, status: "pending" }, data: { expiresAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } });
      const { processWalletRedemptions } = await import("../src/lib/wallet/service");
      const run = await processWalletRedemptions({ skipShopify: true });
      console.log(`Backdated ${moved.count} unused code(s). Expiry job: ${run.expired} expired, ${(run.pointsReturnedCents / 100).toFixed(2)} points returned (across all members).`);
    } else if (command === "wallet-show") {
      const [email] = args;
      if (!email) throw new Error("Usage: wallet-show <email>");
      const { getWalletSummary } = await import("../src/lib/wallet/ledger");
      const sum = await getWalletSummary("customer", email, 50);
      console.log(`\nBalance: ${(sum.balanceCents / 100).toFixed(2)} points`);
      console.log("Ledger (newest first):");
      for (const t of sum.transactions) console.log(`  ${t.createdAt.toISOString().slice(0, 16)}  ${t.type.padEnd(10)} ${(t.amountCents / 100).toFixed(2).padStart(9)}  -> ${(t.balanceAfterCents / 100).toFixed(2).padStart(8)}  ${t.reason ?? ""}`);
      console.log("Unused codes:");
      for (const r of sum.pendingRedemptions) console.log(`  ${r.code}  ${(r.amountCents / 100).toFixed(2)}  expires ${r.expiresAt.toISOString().slice(0, 10)}`);
      if (sum.pendingRedemptions.length === 0) console.log("  (none)");
    } else if (command === "wallet-reset") {
      const [email] = args;
      if (!email) throw new Error("Usage: wallet-reset <email>");
      const w = await prisma.walletAccount.deleteMany({ where: { kind: "customer", ownerKey: email.trim().toLowerCase() } });
      const m = await prisma.customerSignup.deleteMany({ where: { email: { equals: email, mode: "insensitive" } } });
      console.log(`Deleted ${w.count} wallet(s) and ${m.count} membership record(s) for ${email}.`);
    } else {
      console.log("Commands: order | clear-orders | expire | member | customer-login | wallet-order | wallet-refund | wallet-expire | wallet-show | wallet-reset  (see the top of scripts/devTools.ts)");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
