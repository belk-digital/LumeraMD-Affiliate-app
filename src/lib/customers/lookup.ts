import { prisma } from "@/lib/prisma";

/**
 * The membership a login for this email should open: their current (non-cancelled) one if they have
 * it, otherwise their most recent cancelled one so they can still see their history.
 */
export async function findMembershipByEmail(email: string) {
  const where = { email: { equals: email.trim(), mode: "insensitive" as const } };
  return (
    (await prisma.customerSignup.findFirst({
      where: { ...where, status: { not: "cancelled" } },
      orderBy: { createdAt: "desc" },
    })) ?? (await prisma.customerSignup.findFirst({ where, orderBy: { createdAt: "desc" } }))
  );
}
