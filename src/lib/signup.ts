import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Disallows <, >, ", ' and other characters that could break out of HTML/attribute
// context when this address is later interpolated into outbound emails.
export const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/** Reads `?ref=` and returns the inviter's public display info (never their email), if valid. */
export async function getInviter(
  rawRef: string | string[] | undefined,
  opts: { forTeam?: boolean } = {},
) {
  const slug = typeof rawRef === "string" ? rawRef : undefined;
  if (!slug) return null;
  const inviter = await prisma.affiliate.findUnique({
    where: { referralSlug: slug },
    select: { status: true, displayName: true, canRecruit: true },
  });
  // forTeam: the link is recruiting someone onto a team, so the inviter must be allowed to recruit.
  const eligible = inviter && inviter.status === "approved" && (!opts.forTeam || inviter.canRecruit);
  return eligible ? { slug, displayName: inviter.displayName } : null;
}

/**
 * Who sent this person? The invite slug wins, then the referral cookie. The referrer is always
 * looked up server-side and must be an approved affiliate other than the person signing up.
 */
export async function resolveReferrerId(
  req: NextRequest,
  referralSlug: string | undefined,
  signupEmail: string,
  opts: { forTeam?: boolean } = {},
): Promise<string | null> {
  const cookieAffiliateId = req.cookies.get("affiliate_ref")?.value;
  const referrer = referralSlug
    ? await prisma.affiliate.findUnique({ where: { referralSlug } })
    : cookieAffiliateId
      ? await prisma.affiliate.findUnique({ where: { id: cookieAffiliateId } })
      : null;
  return referrer &&
    referrer.status === "approved" &&
    (!opts.forTeam || referrer.canRecruit) &&
    referrer.userEmail.toLowerCase() !== signupEmail.toLowerCase()
    ? referrer.id
    : null;
}
