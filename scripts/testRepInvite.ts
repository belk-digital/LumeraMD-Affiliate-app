// Walks the real sales rep signup route and the real approval, to see who a new rep ends up under when they
// join through someone's invite link. Calls the route handler in-process (no email is sent), on the testing DB
// only, and deletes everything it creates.
//
//   node --env-file=.env --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/testRepInvite.ts </dev/null
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { POST as signupRoute } from "../src/app/api/sales-reps/signup/route";
import { createAffiliateFromSalesRepSignup } from "../src/lib/affiliates/createFromSalesRep";

const TAG = `inv${Date.now()}`;
const ok = (label: string) => console.log("  ✓", label);
const email = (n: string) => `${TAG}-${n}@example.test`;

async function signup(name: string, opts: { slug?: string; cookieAffiliateId?: string }) {
  const form = new FormData();
  form.set("firstName", "Test");
  form.set("lastName", name);
  form.set("email", email(name));
  form.set("phone", "+1 415 555 0134");
  form.set("plan", "agent");
  if (opts.slug) form.set("referralSlug", opts.slug);
  const req = new NextRequest("http://localhost:3000/api/sales-reps/signup", {
    method: "POST",
    body: form,
    headers: opts.cookieAffiliateId ? { cookie: `affiliate_ref=${opts.cookieAffiliateId}` } : {},
  });
  const res = await signupRoute(req);
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  return prisma.salesRepSignup.findUniqueOrThrow({ where: { id: body.signup.id } });
}

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "").host;
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");
  delete process.env.RESEND_API_KEY;

  const mk = (n: string, canRecruit: boolean) =>
    prisma.affiliate.create({
      data: { userEmail: email(n), displayName: n, status: "approved", referralSlug: `${TAG}-${n}`, canRecruit },
    });
  const on = await mk("recruiter-on", true);
  const off = await mk("recruiter-off", false);

  try {
    console.log("\nSponsor has recruiting ON");
    const a = await signup("viaslug", { slug: on.referralSlug });
    assert.equal(a.referredByAffiliateId, on.id);
    ok("signing up through their invite link records them as the sponsor");
    const aAff = await createAffiliateFromSalesRepSignup(a.id);
    assert.equal(aAff.parentAffiliateId, on.id);
    ok("on approval the rep lands under that sponsor");

    const b = await signup("viacookie", { cookieAffiliateId: on.id });
    assert.equal(b.referredByAffiliateId, on.id);
    ok("same through the tracking cookie from clicking their /ref link (no slug in the form)");

    console.log("\nSponsor has recruiting OFF");
    const c = await signup("offslug", { slug: off.referralSlug });
    assert.equal(c.referredByAffiliateId, null);
    const cAff = await createAffiliateFromSalesRepSignup(c.id);
    assert.equal(cAff.parentAffiliateId, null);
    ok("the invite is ignored: they sign up fine but end up at the top level");

    console.log("\nNo link at all");
    const d = await signup("nolink", {});
    assert.equal(d.referredByAffiliateId, null);
    ok("top level");
    console.log("\nall passed");
  } finally {
    const ids = [on.id, off.id];
    const sigs = await prisma.salesRepSignup.findMany({ where: { email: { startsWith: TAG } }, select: { id: true, linkedAffiliateId: true } });
    const affs = await prisma.affiliate.findMany({ where: { userEmail: { startsWith: TAG } }, select: { id: true } });
    const allIds = affs.map((x) => x.id);
    await prisma.notification.deleteMany({ where: { affiliateId: { in: allIds } } }).catch(() => {});
    await prisma.salesRepSignup.deleteMany({ where: { id: { in: sigs.map((s) => s.id) } } });
    await prisma.customerSignup.deleteMany({ where: { email: { startsWith: TAG } } });
    await prisma.affiliate.deleteMany({ where: { id: { in: allIds.filter((i) => !ids.includes(i)) } } });
    await prisma.affiliate.deleteMany({ where: { id: { in: ids } } });
    console.log("cleaned up", allIds.length, "test affiliates");
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
