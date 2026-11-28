import { NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { getCatalog } from "@/lib/membership/plans.server";

// The membership packages as currently sold. Used by the admin forms (Add member / Add sales rep).
export async function GET() {
  const { error } = await requireAdminOrResponse();
  if (error) return error;
  const catalog = await getCatalog();
  return NextResponse.json({
    plans: catalog.plans,
    customerPlans: catalog.customerPlans,
    agent: catalog.plans.agent,
    testKitPrice: catalog.testKitPrice,
  });
}
