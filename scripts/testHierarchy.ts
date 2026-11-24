// Checks the hierarchy views against a real database: an agent sees only the qualified uplines above
// them (capped at the number of paid slots), their own team below, and nothing like an email.
//
// Run against the TESTING branch only:
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx scripts/testHierarchy.ts
//
// All rows it creates are deleted at the end.
import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { getAdminHierarchy, getAgentHierarchy, type HierarchyNode } from "../src/lib/affiliates/hierarchy";

const TAG = `hier${Date.now()}`;
const created: string[] = [];

async function make(name: string | null, parentId: string | null, status: "approved" | "suspended" = "approved") {
  const slug = `${TAG}-${(name ?? "anon").toLowerCase()}-${created.length}`;
  const a = await prisma.affiliate.create({
    data: {
      userEmail: `${slug}@example.test`,
      displayName: name,
      status,
      referralSlug: slug,
      parentAffiliateId: parentId,
    },
  });
  created.push(a.id);
  return a;
}

/** Flattens a single-path tree top-down into [name, kind, level]. */
function spine(n: HierarchyNode): [string, string, number | undefined][] {
  const out: [string, string, number | undefined][] = [[n.name, n.kind, n.level]];
  if (n.kind !== "self" && n.children[0]) out.push(...spine(n.children[0]));
  return out;
}

function names(n: HierarchyNode): string[] {
  return [n.name, ...n.children.flatMap(names)];
}

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  console.log("database host:", host);
  if (host.includes("cold-forest")) throw new Error("Refusing to run against production.");

  // Same genealogy as the unilevel test, nearest-first above Ashley: Tyler, Lisa, Mason, Kevin, Sarah,
  // Greg, Jordan, Michelle. Qualified = 3 approved direct recruits.
  const chainNames = ["Michelle", "Jordan", "Greg", "Sarah", "Kevin", "Mason", "Lisa", "Tyler"];
  const qualified = new Set(["Tyler", "Mason", "Sarah", "Greg", "Michelle"]);
  const byName: Record<string, string> = {};
  let parent: string | null = null;
  for (const n of chainNames) {
    const a = await make(n, parent);
    byName[n] = a.id;
    parent = a.id;
  }
  const ashley = await make("Ashley", byName["Tyler"]);
  for (const n of chainNames) {
    if (qualified.has(n)) {
      await make(`${n}fillerA`, byName[n]);
      await make(`${n}fillerB`, byName[n]);
    }
  }
  // Ashley's own team: a named recruit, one with no display name, and a suspended one; plus a grandchild.
  const bo = await make("Bo", ashley.id);
  await make(null, ashley.id);
  await make("Sus", ashley.id, "suspended");
  await make("Cy", bo.id);

  const ok = (label: string) => console.log("  ✓", label);

  try {
    console.log("\nAgent view (Ashley)");
    const v = await getAgentHierarchy(ashley.id);
    assert.ok(v);
    const top = spine(v.root);
    assert.deepEqual(
      top.map((t) => `${t[0]}:${t[1]}:${t[2] ?? ""}`),
      ["Michelle:upline:5", "Greg:upline:4", "Sarah:upline:3", "Mason:upline:2", "Tyler:upline:1", "Ashley:self:"],
    );
    ok("5 qualified uplines top-down, Level 1 = nearest; Lisa, Kevin, Jordan skipped");
    assert.equal(v.uplineCount, 5);

    const self = (function find(n: HierarchyNode): HierarchyNode {
      return n.kind === "self" ? n : find(n.children[0]);
    })(v.root);
    const team = names(self).slice(1);
    assert.ok(team.includes("Bo") && team.includes("Cy") && team.includes("Sus"));
    ok("own team below, including grandchildren and suspended members");
    assert.ok(team.some((t) => t.includes("***")));
    assert.ok(!JSON.stringify(v).includes("@example.test@") && !JSON.stringify(v).match(/hier\d+-anon-\d+@example/));
    ok("a rep with no display name is masked, never a full email");
    assert.equal(self.teamSize, 4);
    ok("team size counts everyone below");

    console.log("\nCap: a 6th qualified upline (Jordan) must not appear");
    await make("JordanA", byName["Jordan"]);
    await make("JordanB", byName["Jordan"]);
    const v2 = await getAgentHierarchy(ashley.id);
    assert.ok(v2);
    assert.equal(v2.uplineCount, 5);
    assert.ok(!names(v2.root).includes("Michelle")); // furthest is now dropped, nearest five kept
    assert.ok(names(v2.root).includes("Jordan"));
    ok("only the nearest 5 qualified uplines are returned");

    console.log("\nAdmin view");
    const adm = await getAdminHierarchy();
    const all = names(adm.root);
    for (const n of chainNames) assert.ok(all.includes(n), `${n} missing`);
    ok("every affiliate appears, uncapped");
    const em = JSON.stringify(adm.root).includes("@example.test");
    assert.ok(em);
    ok("admin nodes carry email and sales");
    console.log("\nAll checks passed.");
  } finally {
    // Children before parents.
    for (let i = 0; i < 3; i++) {
      for (const id of [...created].reverse()) {
        await prisma.affiliate.delete({ where: { id } }).catch(() => {});
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
