// Exercises POST /api/lumera-ops/hierarchy/move on a running dev server (testing DB only):
//   pnpm dlx tsx scripts/testMove.ts http://localhost:3111
// Needs mock data from seedHierarchyMock.ts. Moves a mock rep around, then puts it back.
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { createSessionToken } from "../src/lib/admin/session";

const base = process.argv[2] ?? "http://localhost:3111";

async function move(id: string, parentId: string | null, cookie?: string) {
  const res = await fetch(`${base}/api/lumera-ops/hierarchy/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: `admin_session=${cookie}` } : {}) },
    body: JSON.stringify({ id, parentId }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "").host;
  if (host.includes("cold-forest")) throw new Error("Refusing to run against production.");

  const cookie = createSessionToken("test@example.com");
  const mocks = await prisma.affiliate.findMany({
    where: { userEmail: { endsWith: "@mock.lumera.test" } },
    select: { id: true, displayName: true, status: true, parentAffiliateId: true },
  });
  // A mock rep that has a mock child, to try moving under its own team.
  const parent = mocks.find((m) => m.status === "approved" && mocks.some((c) => c.parentAffiliateId === m.id));
  assert.ok(parent, "needs mock data with a parent/child pair");
  const child = mocks.find((m) => m.parentAffiliateId === parent.id && m.status === "approved")!;
  const original = parent.parentAffiliateId;

  assert.equal((await move(parent.id, null)).status, 401, "no cookie is rejected");
  assert.equal((await move(parent.id, parent.id, cookie)).status, 400, "self");
  const cycle = await move(parent.id, child.id, cookie);
  assert.equal(cycle.status, 400, "under own team");
  assert.match(cycle.body.error, /own team/);
  assert.equal((await move(parent.id, "nope", cookie)).status, 404, "unknown parent");
  const suspended = mocks.find((m) => m.status !== "approved");
  if (suspended) assert.equal((await move(parent.id, suspended.id, cookie)).status, 400, "unapproved target");

  assert.equal((await move(parent.id, null, cookie)).status, 200, "to top level");
  assert.equal((await prisma.affiliate.findUnique({ where: { id: parent.id } }))!.parentAffiliateId, null);
  assert.equal((await move(parent.id, original, cookie)).status, 200, "restore");
  assert.equal((await prisma.affiliate.findUnique({ where: { id: parent.id } }))!.parentAffiliateId, original);

  console.log("all move checks passed");
}

main().finally(() => prisma.$disconnect());
