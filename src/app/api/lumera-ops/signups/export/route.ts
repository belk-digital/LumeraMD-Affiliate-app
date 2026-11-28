import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { customerWhere, parseSignupQuery, planLabel, repWhere } from "@/lib/admin/signupFilters";
import { monthlyPriceFor, type PlanKey } from "@/lib/membership/plans";
import { getCatalog } from "@/lib/membership/plans.server";

const MAX_ROWS = 5000;

// A cell that starts with = + - or @ would run as a formula when the CSV is opened in a
// spreadsheet, so those get a leading apostrophe.
function cell(value: unknown): string {
  let s = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const csv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

/**
 * CSV of the signups an admin is looking at: the same search and filters as the page, or just the
 * rows they ticked (`ids`). `type` is "customers" or "sales-reps".
 */
export async function GET(req: NextRequest) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const params = req.nextUrl.searchParams;
  const type = params.get("type");
  const query = parseSignupQuery(params);
  const ids = (params.get("ids") ?? "").split(",").filter(Boolean).slice(0, 500);
  const order = query.sort === "oldest" ? "asc" : "desc";
  const plans = (await getCatalog()).plans;

  const referrers = await prisma.affiliate.findMany({ select: { id: true, displayName: true, userEmail: true } });
  const referrerName = new Map(referrers.map((r) => [r.id, r.displayName ?? r.userEmail]));

  let body: string;
  if (type === "customers") {
    const rows = await prisma.customerSignup.findMany({
      where: ids.length ? { id: { in: ids } } : customerWhere(query),
      orderBy: { createdAt: order },
      take: MAX_ROWS,
    });
    body = csv([
      ["Name", "Email", "Phone", "Plan", "Monthly price", "Status", "Complimentary", "Active through", "Test kit", "Referred by", "Member discount code", "Signed up"],
      ...rows.map((c) => [
        `${c.firstName} ${c.lastName}`.trim(),
        c.email,
        c.phone,
        planLabel(c.plan, plans),
        plans[c.plan as PlanKey] ? monthlyPriceFor(c, plans[c.plan as PlanKey]) : "",
        c.status,
        c.complimentary ? "yes" : "no",
        c.currentPeriodEnd,
        c.wantsTestKit ? "yes" : "no",
        c.referredByAffiliateId ? referrerName.get(c.referredByAffiliateId) : "",
        c.memberDiscountCode,
        c.createdAt,
      ]),
    ]);
  } else if (type === "sales-reps") {
    const rows = await prisma.salesRepSignup.findMany({
      where: ids.length ? { id: { in: ids } } : repWhere(query),
      orderBy: { createdAt: order },
      take: MAX_ROWS,
    });
    body = csv([
      ["Name", "Email", "Phone", "Type of sales", "Annual gross sales", "Plan", "Status", "Referred by", "Review notes", "Applied on"],
      ...rows.map((r) => [
        [r.firstName, r.lastName].filter(Boolean).join(" "),
        r.email,
        r.phone,
        r.salesType,
        r.annualGrossSales,
        r.plan ? planLabel(r.plan, plans) : "",
        r.status,
        r.referredByAffiliateId ? referrerName.get(r.referredByAffiliateId) : "",
        r.reviewNotes,
        r.createdAt,
      ]),
    ]);
  } else {
    return Response.json({ error: "unknown export type" }, { status: 400 });
  }

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
