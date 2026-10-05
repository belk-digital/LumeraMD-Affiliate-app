import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customers/session";

/**
 * For member pages: returns the logged-in member's membership, or sends them to the login page.
 * Checked on every page (not in a layout) because layouts don't re-run on client navigations.
 */
export async function requireCustomer() {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");
  const customer = await prisma.customerSignup.findUnique({ where: { id: session.customerId } });
  if (!customer) redirect("/account/login");
  return customer;
}
