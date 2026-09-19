import "dotenv/config";
delete process.env.RESEND_API_KEY;
import { prisma } from "../src/lib/prisma";
import { attributeOrder } from "../src/lib/affiliates/commission";
import { updateAffiliateStats } from "../src/lib/affiliates/stats";

async function main() {
  const started = new Date();
  const aff = await prisma.affiliate.findFirstOrThrow({ where: { userEmail: "test-affiliate@example.com" } });
  const other = await prisma.affiliate.findFirstOrThrow({ where: { userEmail: "jane-creator@example.com" } });

  // click recorded by /ref (the curl above created one for test-affiliate)
  const click = await prisma.affiliateClick.findFirstOrThrow({ where: { affiliateId: aff.id, createdAt: { gte: new Date(Date.now() - 5 * 60_000) } }, orderBy: { createdAt: "desc" } });
  const otherClick = await prisma.affiliateClick.create({ data: { affiliateId: other.id, source: "referral_link" } });
  const mk = (id: string) => ({ id, name: "#CLK", subtotalPrice: 100, totalDiscounts: 0, discountCodes: [] as string[], customerEmail: "buyer@example.com" });
  const created: string[] = [];

  // 1) real click, no coupon -> attributed as referral_link and click marked converted
  const c1 = await attributeOrder({ order: mk("TEST-CLK-1-" + Date.now()), cookieAffiliateId: aff.id, cookieClickId: click.id });
  created.push(c1!.id);
  const clickAfter = await prisma.affiliateClick.findUniqueOrThrow({ where: { id: click.id } });
  console.log("1 real click       ->", c1?.attributionSource, "| click converted:", clickAfter.convertedToOrder, "| linked:", c1?.attributionClickId === click.id);

  // 2) same click reused, no coupon -> not attributable
  const c2 = await attributeOrder({ order: mk("TEST-CLK-2-" + Date.now()), cookieAffiliateId: aff.id, cookieClickId: click.id });
  console.log("2 spent click      ->", c2 === null ? "not attributed (correct)" : "ATTRIBUTED (wrong)");
  if (c2) created.push(c2.id);

  // 3) another affiliate's click id on this affiliate -> click ignored, not linked
  const c3 = await attributeOrder({ order: mk("TEST-CLK-3-" + Date.now()), cookieAffiliateId: aff.id, cookieClickId: otherClick.id });
  if (c3) created.push(c3.id);
  const oc = await prisma.affiliateClick.findUniqueOrThrow({ where: { id: otherClick.id } });
  console.log("3 foreign click id ->", c3?.attributionClickId === null ? "click not linked (correct)" : "LINKED (wrong)", "| foreign click untouched:", !oc.convertedToOrder);

  // 4) unknown affiliate id in cart attribute -> nothing
  const c4 = await attributeOrder({ order: mk("TEST-CLK-4-" + Date.now()), cookieAffiliateId: "does-not-exist", cookieClickId: null });
  console.log("4 fake affiliate   ->", c4 === null ? "not attributed (correct)" : "ATTRIBUTED (wrong)");

  // cleanup
  await prisma.affiliateConversion.deleteMany({ where: { id: { in: created } } });
  await prisma.affiliateClick.deleteMany({ where: { id: { in: [click.id, otherClick.id] } } });
  await prisma.notification.deleteMany({ where: { affiliateId: { in: [aff.id, other.id] }, createdAt: { gte: started } } });
  await updateAffiliateStats(aff.id);
  await updateAffiliateStats(other.id);
  const a = await prisma.affiliate.findUniqueOrThrow({ where: { id: aff.id } });
  console.log("cleaned. test-affiliate clicks:", a.totalClicks, "| pending:", a.totalCommissionPending);
}
main().finally(() => prisma.$disconnect());
