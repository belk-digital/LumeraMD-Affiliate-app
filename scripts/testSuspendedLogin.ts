// Affiliate login for approved, suspended and unknown emails: all three get the same response (so the
// form can't be used to find out who has an account), but only an approved account gets a login link;
// a suspended one is emailed an explanation instead. Logs emails instead of sending them, refuses to
// run against production, and deletes everything it creates.
//
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx --env-file=.env.local scripts/testSuspendedLogin.ts
import "dotenv/config"; // does not override an already-exported DATABASE_URL
delete process.env.RESEND_API_KEY;
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { POST as requestLogin } from "../src/app/api/affiliates/auth/request/route";

const TAG = `susp${Date.now()}`;
const ok = (label: string) => console.log("  ✓", label);

/** Calls the login route and returns its JSON plus everything it tried to email. */
async function login(email: string) {
  const logged: string[] = [];
  const realLog = console.log;
  console.log = (...args: unknown[]) => void logged.push(args.map(String).join(" "));
  try {
    const res = await requestLogin(
      new NextRequest("http://localhost/api/affiliates/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
        body: JSON.stringify({ email }),
      }),
    );
    return { status: res.status, body: await res.json(), emails: logged.join("\n") };
  } finally {
    console.log = realLog;
  }
}

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  console.log("database host:", host);
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");

  const approved = await prisma.affiliate.create({
    data: { userEmail: `${TAG}-ok@example.test`, status: "approved", referralSlug: `${TAG}-ok` },
  });
  const suspended = await prisma.affiliate.create({
    data: {
      userEmail: `${TAG}-sus@example.test`,
      status: "suspended",
      suspendReason: "Inactive: did not meet the 90-day requirement.",
      referralSlug: `${TAG}-sus`,
    },
  });

  try {
    const a = await login(approved.userEmail);
    const s = await login(suspended.userEmail);
    const u = await login(`${TAG}-nobody@example.test`);

    assert.deepEqual([a.status, a.body], [200, { ok: true }]);
    assert.deepEqual([s.status, s.body], [200, { ok: true }]);
    assert.deepEqual([u.status, u.body], [200, { ok: true }]);
    ok("approved, suspended and unknown emails all get the same response");

    assert.ok(a.emails.includes("login link"), "approved account should be emailed a login link");
    assert.ok(a.emails.includes("/api/affiliates/auth/callback?token="));
    assert.equal(await prisma.affiliateLoginToken.count({ where: { affiliateId: approved.id } }), 1);
    ok("an approved account gets a login link");

    assert.ok(s.emails.includes("is suspended"), "suspended account should be emailed an explanation");
    assert.ok(s.emails.includes("activity requirement"), "inactivity reason should be mentioned");
    assert.ok(!s.emails.includes("auth/callback"), "suspended account must not get a login link");
    assert.equal(await prisma.affiliateLoginToken.count({ where: { affiliateId: suspended.id } }), 0);
    ok("a suspended account gets an explanation and no login link");

    assert.equal(u.emails.trim(), "", "unknown address should get no email");
    ok("an unknown address gets nothing");

    console.log("\nAll suspended-login checks passed.");
  } finally {
    await prisma.affiliateLoginToken.deleteMany({ where: { affiliateId: { in: [approved.id, suspended.id] } } });
    await prisma.affiliate.deleteMany({ where: { id: { in: [approved.id, suspended.id] } } });
  }
}

main()
  .catch((err) => {
    console.error("\nFAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
