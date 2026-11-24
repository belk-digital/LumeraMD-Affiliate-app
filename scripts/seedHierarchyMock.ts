// Adds a mock recruiting tree around one affiliate so the Hierarchy pages have something to show:
// a chain of uplines above them (one deliberately unqualified, so it is skipped) and a team below.
// Testing database only. Everything it creates uses @mock.lumera.test emails / mock-hier- order ids.
//
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx scripts/seedHierarchyMock.ts kfahaduu@gmail.com           # add
//   pnpm dlx tsx scripts/seedHierarchyMock.ts kfahaduu@gmail.com --remove  # delete it all and restore
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const DOMAIN = "mock.lumera.test";
const ORDER_PREFIX = "mock-hier-";

async function make(name: string, parentId: string | null, status: "approved" | "suspended" = "approved") {
  const slug = `mock-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return prisma.affiliate.create({
    data: { userEmail: `${slug}@${DOMAIN}`, displayName: name, status, referralSlug: slug, parentAffiliateId: parentId },
  });
}

async function sale(affiliateId: string, n: number, amount: number) {
  await prisma.affiliateConversion.create({
    data: {
      affiliateId,
      shopifyOrderId: `${ORDER_PREFIX}${affiliateId}-${n}`,
      attributionSource: "referral_link",
      orderSubtotal: amount,
      eligibleSubtotal: amount,
      commissionRate: 10,
      commissionAmount: amount / 10,
      status: "approved",
    },
  });
}

async function remove(target: { id: string }) {
  await prisma.affiliateConversion.deleteMany({ where: { shopifyOrderId: { startsWith: ORDER_PREFIX } } });
  await prisma.affiliate.update({ where: { id: target.id }, data: { parentAffiliateId: null } });
  // Children first: repeat until nothing is left (a parent can't go while a child references it).
  for (let i = 0; i < 12; i++) {
    const left = await prisma.affiliate.findMany({ where: { userEmail: { endsWith: `@${DOMAIN}` } }, select: { id: true } });
    if (left.length === 0) break;
    for (const a of left) await prisma.affiliate.delete({ where: { id: a.id } }).catch(() => {});
  }
  console.log("Removed mock data; target is top-level again.");
}

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Usage: seedHierarchyMock.ts <affiliate email> [--remove]");
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  console.log("database host:", host);
  if (host.includes("cold-forest")) throw new Error("Refusing to run against production.");

  const target = await prisma.affiliate.findFirst({ where: { userEmail: { equals: email, mode: "insensitive" } } });
  if (!target) throw new Error(`No affiliate with email ${email}`);

  if (process.argv.includes("--remove")) return remove(target);
  if (await prisma.affiliate.count({ where: { userEmail: { endsWith: `@${DOMAIN}` } } })) {
    throw new Error("Mock data already exists. Run with --remove first.");
  }

  // Uplines, top to bottom. Qualified = 3 approved direct recruits; Tom only has the one below him.
  const victoria = await make("Victoria Hale", null);
  const marcus = await make("Marcus Chen", victoria.id);
  const tom = await make("Tom Reyes", marcus.id); // unqualified: skipped in the agent's view
  const priya = await make("Priya Nair", tom.id);
  const daniel = await make("Daniel Ortiz", priya.id);
  await prisma.affiliate.update({ where: { id: target.id }, data: { parentAffiliateId: daniel.id } });
  for (const [up, a, b] of [
    [victoria, "Elena Voss", "Raj Patel"],
    [marcus, "Hannah Fox", "Leo Marin"],
    [priya, "Grace Lin", "Owen Hayes"],
    [daniel, "Mia Torres", "Sam Okafor"],
  ] as const) {
    await make(a, up.id);
    await make(b, up.id);
  }

  // The target's own team.
  const ava = await make("Ava Brooks", target.id);
  const marcusLee = await make("Marcus Lee", target.id);
  const priyaShah = await make("Priya Shah", target.id);
  await make("Jade Wilson", target.id, "suspended");
  const ben = await make("Ben Carter", target.id);
  await make("Liam Park", ava.id);
  await make("Sofia Reyes", ava.id);
  const noah = await make("Noah Kim", ava.id);
  await make("Ella Cho", noah.id);
  await make("Omar Ali", priyaShah.id);
  await make("Chloe Dunn", priyaShah.id);
  await make("Zoe Grant", ben.id);

  // A few sales so the admin cards show something.
  for (const [a, amt] of [[victoria, 4200], [marcus, 2650], [daniel, 1800], [ava, 3100], [marcusLee, 540], [priyaShah, 1250], [ben, 320]] as const) {
    await sale(a.id, 1, amt);
  }
  console.log(`Done. ${email} now has 4 qualified uplines (+ 1 unqualified) and a team of 11.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
