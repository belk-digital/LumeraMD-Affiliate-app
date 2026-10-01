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
    } else {
      console.log("Commands: order <referral-slug> <amount> [--approve] | clear-orders | expire <customer-email>");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
