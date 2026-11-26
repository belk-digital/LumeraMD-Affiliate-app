// Checks adminAdd (the Add member / Add sales rep buttons) on the testing DB. Cleans up after itself.
//   RESEND_API_KEY= npx tsx --env-file=.env --env-file=.env.local scripts/testAdminAdd.ts
// Leave RESEND_API_KEY empty so no real email goes out; .env.local has SKIP_SHOPIFY=true so no real discount codes.
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { AddError, adminAdd, parseAddInput } from "../src/lib/membership/adminAdd";

const tag = `addtest${Date.now()}`;
const email = (n: string) => `${tag}-${n}@mock.lumera.test`;
const input = (over: Record<string, unknown>) =>
  parseAddInput(
    { kind: "member", firstName: "Test", lastName: "Person", email: email("m"), phone: "+1 2015550123", plan: "customer_plus", billing: "recurring", ...over },
    "admin@test",
  );

async function main() {
  if (new URL(process.env.DATABASE_URL ?? "").host.includes("cold-forest")) throw new Error("Refusing to run against production.");
  if (process.env.RESEND_API_KEY) throw new Error("Run with RESEND_API_KEY empty.");
  if (process.env.SKIP_SHOPIFY !== "true") throw new Error("Run with SKIP_SHOPIFY=true so no real discount codes are created.");

  const sponsor = await prisma.affiliate.findFirst({ where: { status: "approved", userEmail: { endsWith: "@mock.lumera.test" } } });
  assert.ok(sponsor, "needs mock data");

  const bad = async (over: Record<string, unknown>, status: number) =>
    assert.rejects(() => adminAdd(input(over)), (e: unknown) => e instanceof AddError && e.status === status);
  await bad({ firstName: "R2D2" }, 400);
  await bad({ email: "nope" }, 400);
  await bad({ plan: "gold" }, 400);
  await bad({ phone: "+1 123" }, 400);
  await bad({ billing: "free", note: "" }, 400);
  await bad({ sponsorId: "does-not-exist" }, 404);
  await bad({ kind: "rep", phone: "" }, 400); // rep needs a phone

  // Member, recurring: pending until they pay, referred by the sponsor.
  const m = await adminAdd(input({ sponsorId: sponsor.id }));
  const member = await prisma.customerSignup.findUnique({ where: { id: m.id } });
  assert.equal(member?.status, "pending_payment");
  assert.equal(member?.referredByAffiliateId, sponsor.id);
  assert.equal(member?.complimentary, false);
  // The same email again updates the pending membership instead of adding a second.
  const again = await adminAdd(input({ plan: "customer_basic" }));
  assert.equal(again.id, m.id, "a pending membership is updated, not duplicated");
  assert.equal((await prisma.customerSignup.findUnique({ where: { id: m.id } }))?.plan, "customer_basic");

  // Member, free: active right away, flagged complimentary, note on record.
  const f = await adminAdd(input({ email: email("f"), billing: "free", note: "Friend of the founder" }));
  const free = await prisma.customerSignup.findUnique({ where: { id: f.id } });
  assert.equal(free?.status, "active");
  assert.equal(free?.complimentary, true);
  assert.equal(free?.complimentaryNote, "Friend of the founder");
  assert.equal(free?.complimentaryBy, "admin@test");
  await bad({ email: email("f") }, 409); // already has a live membership

  // Rep, recurring: approved affiliate under the sponsor, with an unpaid agent membership.
  const r = await adminAdd(input({ kind: "rep", email: email("r"), sponsorId: sponsor.id }));
  const rep = await prisma.affiliate.findUnique({ where: { id: r.id } });
  assert.equal(rep?.status, "approved");
  assert.equal(rep?.parentAffiliateId, sponsor.id);
  const repMember = await prisma.customerSignup.findFirst({ where: { email: email("r"), plan: "agent" } });
  assert.equal(repMember?.status, "pending_payment");
  await bad({ kind: "rep", email: email("r") }, 409); // already an affiliate

  // Rep, free: membership active and complimentary.
  const rf = await adminAdd(input({ kind: "rep", email: email("rf"), billing: "free", note: "Partner" }));
  assert.ok(rf.id);
  const repFree = await prisma.customerSignup.findFirst({ where: { email: email("rf"), plan: "agent" } });
  assert.equal(repFree?.status, "active");
  assert.equal(repFree?.complimentary, true);

  console.log("all admin add checks passed");
}

async function cleanup() {
  const emails = { contains: tag };
  const affs = await prisma.affiliate.findMany({ where: { userEmail: emails }, select: { id: true } });
  const ids = affs.map((a) => a.id);
  await prisma.notification.deleteMany({ where: { affiliateId: { in: ids } } });
  await prisma.customerSignup.deleteMany({ where: { email: emails } });
  await prisma.salesRepSignup.deleteMany({ where: { email: emails } });
  await prisma.affiliate.deleteMany({ where: { id: { in: ids } } });
}

main()
  .finally(cleanup)
  .finally(() => prisma.$disconnect());
