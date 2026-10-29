import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePortalKey } from "@/lib/portal/auth";
import { portalMember } from "@/lib/portal/member";

// Read API for the customer portal. See docs/portal-integration.md.
//   GET /api/v1/members?email=a@b.com           one member, by email
//   GET /api/v1/members?updated_since=<ISO>     members changed since then (oldest first), paged

const noStore = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const denied = await requirePortalKey(req);
  if (denied) return denied;

  const params = req.nextUrl.searchParams;
  const email = params.get("email")?.trim();

  if (email) {
    // Several rows can share an email (an old cancelled membership, then a new one): the newest
    // one that isn't cancelled wins, otherwise the newest cancelled one.
    const rows = await prisma.customerSignup.findMany({
      where: { email: { equals: email, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
    });
    const row = rows.find((r) => r.status !== "cancelled") ?? rows[0];
    if (!row) return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
    return NextResponse.json({ member: portalMember(row) }, { headers: noStore });
  }

  const limit = Math.min(Math.max(parseInt(params.get("limit") ?? "100", 10) || 100, 1), 500);
  let after: { at: Date; id: string } | null = null;

  const cursor = params.get("cursor");
  if (cursor) {
    try {
      const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
      const at = new Date(iso);
      if (!id || Number.isNaN(at.getTime())) throw new Error("bad cursor");
      after = { at, id };
    } catch {
      return NextResponse.json({ error: "invalid_cursor" }, { status: 400, headers: noStore });
    }
  }

  const sinceParam = params.get("updated_since");
  let since: Date | null = null;
  if (sinceParam) {
    since = new Date(sinceParam);
    if (Number.isNaN(since.getTime())) {
      return NextResponse.json({ error: "invalid_updated_since" }, { status: 400, headers: noStore });
    }
  }
  if (!after && !since) {
    return NextResponse.json({ error: "email_or_updated_since_required" }, { status: 400, headers: noStore });
  }

  // Ordered by (updated_at, id) so a page boundary can never skip or repeat a member.
  const rows = await prisma.customerSignup.findMany({
    where: after
      ? { OR: [{ updatedAt: { gt: after.at } }, { updatedAt: after.at, id: { gt: after.id } }] }
      : { updatedAt: { gte: since! } },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return NextResponse.json(
    {
      members: page.map((r) => portalMember(r)),
      next_cursor:
        rows.length > limit && last
          ? Buffer.from(`${last.updatedAt.toISOString()}|${last.id}`).toString("base64url")
          : null,
    },
    { headers: noStore },
  );
}
