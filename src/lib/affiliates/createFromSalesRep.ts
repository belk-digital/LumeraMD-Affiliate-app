import { prisma } from "@/lib/prisma";
import { provisionAffiliate } from "@/lib/affiliates/createFromApplication";

export class SalesRepApprovalError extends Error {
  constructor(
    message: string,
    public status: 404 | 409,
  ) {
    super(message);
  }
}

/** "Jane Doe" from the form, or the part of the email before the @ when no name was given. */
function displayNameFor(signup: { firstName: string | null; lastName: string | null; email: string }) {
  const name = [signup.firstName, signup.lastName].filter(Boolean).join(" ").trim();
  return name || signup.email.split("@")[0];
}

/**
 * Approves a sales rep signup: creates the affiliate (the rep's login, referral link and place in
 * the genealogy under whoever referred them) and links the signup to it. Safe to call twice — an
 * already-approved signup just returns its affiliate.
 */
export async function createAffiliateFromSalesRepSignup(
  signupId: string,
  options: { skipShopifyDiscount?: boolean } = {},
) {
  const signup = await prisma.salesRepSignup.findUnique({ where: { id: signupId } });
  if (!signup) throw new SalesRepApprovalError("Signup not found", 404);

  if (signup.linkedAffiliateId) {
    const existing = await prisma.affiliate.findUnique({ where: { id: signup.linkedAffiliateId } });
    if (existing) return existing;
  }

  const taken = await prisma.affiliate.findFirst({
    where: { userEmail: { equals: signup.email, mode: "insensitive" } },
  });
  if (taken) {
    throw new SalesRepApprovalError("This email is already an affiliate.", 409);
  }

  return provisionAffiliate({
    email: signup.email,
    displayName: displayNameFor(signup),
    parentAffiliateId: signup.referredByAffiliateId,
    skipShopifyDiscount: options.skipShopifyDiscount,
    afterCreate: async (affiliate, tx) => {
      await tx.salesRepSignup.update({
        where: { id: signup.id },
        data: { status: "approved", linkedAffiliateId: affiliate.id },
      });
    },
  });
}
