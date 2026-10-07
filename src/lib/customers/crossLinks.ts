import { prisma } from "@/lib/prisma";

// A sales rep is both an affiliate and (on the agent plan) a member, tied together by email. These
// let each dashboard link to the other only when the other side exists.

/** True when this email has a membership that isn't cancelled. */
export async function hasMembership(email: string): Promise<boolean> {
  const member = await prisma.customerSignup.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, status: { not: "cancelled" } },
    select: { id: true },
  });
  return member !== null;
}

/** The approved affiliate account for this email, if any. */
export async function affiliateIdFor(email: string): Promise<string | null> {
  const affiliate = await prisma.affiliate.findFirst({
    where: { userEmail: { equals: email, mode: "insensitive" }, status: "approved" },
    select: { id: true },
  });
  return affiliate?.id ?? null;
}
