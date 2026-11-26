import { prisma } from "@/lib/prisma";
import { isValidName, NAME_ERROR } from "@/lib/fields";
import { validatePhoneString } from "@/lib/phone";
import { EMAIL_RE } from "@/lib/signup";
import { PLANS, isCustomerPlanKey } from "@/lib/membership/plans";
import { MembershipError, grantComplimentary } from "@/lib/membership/lifecycle";
import { notifyMembershipInvite, notifyRepPaymentDue, payLinkFor } from "@/lib/email/membership";
import { createAffiliateFromSalesRepSignup, SalesRepApprovalError } from "@/lib/affiliates/createFromSalesRep";
import { createNotification } from "@/lib/notifications/create";

// Admin adds a member or a sales rep by hand. Either "recurring" (they get the pay link and are charged
// monthly once they add a card) or "free" (complimentary: active straight away, nothing charged).

export class AddError extends Error {
  constructor(
    message: string,
    public status: 400 | 404 | 409,
  ) {
    super(message);
  }
}

export interface AddInput {
  kind: "member" | "rep";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  plan: string;
  wantsTestKit: boolean;
  sponsorId: string | null;
  billing: "recurring" | "free";
  note: string;
  adminEmail: string;
}

export interface AddResult {
  /** CustomerSignup id for a member, affiliate id for a rep. */
  id: string;
  payLink: string | null;
  warnings: string[];
}

export function parseAddInput(body: Record<string, unknown>, adminEmail: string): AddInput {
  const s = (k: string, max = 200) => (typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) : "");
  const kind = body.kind === "rep" ? "rep" : "member";
  return {
    kind,
    firstName: s("firstName", 100).replace(/\s+/g, " "),
    lastName: s("lastName", 100).replace(/\s+/g, " "),
    email: s("email", 254),
    phone: s("phone", 40),
    plan: kind === "rep" ? "agent" : s("plan"),
    wantsTestKit: body.wantsTestKit === true,
    sponsorId: s("sponsorId") || null,
    billing: body.billing === "free" ? "free" : "recurring",
    note: s("note", 500),
    adminEmail,
  };
}

function validate(i: AddInput) {
  if (!i.firstName || !i.lastName) throw new AddError("Enter a first and last name.", 400);
  if (!isValidName(i.firstName) || !isValidName(i.lastName)) throw new AddError(NAME_ERROR, 400);
  if (!i.email || !EMAIL_RE.test(i.email)) throw new AddError("Enter a valid email.", 400);
  const phoneError = validatePhoneString(i.phone, { required: i.kind === "rep" });
  if (phoneError) throw new AddError(phoneError, 400);
  if (i.kind === "member" && !isCustomerPlanKey(i.plan)) throw new AddError("Choose a membership plan.", 400);
  if (i.billing === "free" && !i.note) {
    throw new AddError("Add a note saying who this is and why it is free, so it is on record.", 400);
  }
}

async function checkSponsor(id: string | null) {
  if (!id) return;
  const sponsor = await prisma.affiliate.findUnique({ where: { id }, select: { status: true } });
  if (!sponsor) throw new AddError("That sponsor no longer exists.", 404);
  if (sponsor.status !== "approved") throw new AddError("The sponsor must be an approved affiliate.", 400);
}

export async function adminAdd(input: AddInput): Promise<AddResult> {
  validate(input);
  await checkSponsor(input.sponsorId);
  return input.kind === "member" ? addMember(input) : addRep(input);
}

async function addMember(i: AddInput): Promise<AddResult> {
  const warnings: string[] = [];
  // One live membership per email, as on the public form: a pending one is updated, a live one is refused.
  const existing = await prisma.customerSignup.findFirst({
    where: { email: { equals: i.email, mode: "insensitive" }, status: { not: "cancelled" } },
    orderBy: { createdAt: "desc" },
  });
  if (existing && existing.status !== "pending_payment") {
    throw new AddError("This email already has a membership.", 409);
  }
  const wantsTestKit = i.wantsTestKit && PLANS[i.plan as keyof typeof PLANS].testKitPrice !== undefined;
  const data = {
    firstName: i.firstName,
    lastName: i.lastName,
    phone: i.phone || null,
    plan: i.plan,
    wantsTestKit,
    referredByAffiliateId: i.sponsorId,
  };
  const member = existing
    ? await prisma.customerSignup.update({ where: { id: existing.id }, data })
    : await prisma.customerSignup.create({ data: { ...data, email: i.email } });

  if (i.billing === "free") {
    try {
      const res = await grantComplimentary(member.id, { note: i.note, adminEmail: i.adminEmail });
      warnings.push(...res.warnings);
    } catch (err) {
      if (err instanceof MembershipError) throw new AddError(err.message, err.status === 404 ? 404 : 400);
      throw err;
    }
    return { id: member.id, payLink: null, warnings };
  }

  try {
    await notifyMembershipInvite(member);
  } catch (err) {
    console.error("Membership invite email failed", err);
    warnings.push("The membership was created, but the email to the member could not be sent. Send them the payment link.");
  }
  const payLink = payLinkFor(member);
  if (!payLink) {
    warnings.push("Online payment is not set up, so no payment link was sent. Record their payments from the member's details.");
  }
  return { id: member.id, payLink, warnings };
}

async function addRep(i: AddInput): Promise<AddResult> {
  const warnings: string[] = [];
  const taken = await prisma.affiliate.findFirst({ where: { userEmail: { equals: i.email, mode: "insensitive" } } });
  if (taken) throw new AddError("This email is already an affiliate.", 409);

  // Reuse a signup that is still waiting for review rather than leaving a duplicate beside it.
  const waiting = await prisma.salesRepSignup.findFirst({
    where: { email: { equals: i.email, mode: "insensitive" }, linkedAffiliateId: null },
    orderBy: { createdAt: "desc" },
  });
  const data = {
    firstName: i.firstName,
    lastName: i.lastName,
    phone: i.phone,
    plan: "agent",
    referredByAffiliateId: i.sponsorId,
  };
  const signup = waiting
    ? await prisma.salesRepSignup.update({ where: { id: waiting.id }, data })
    : await prisma.salesRepSignup.create({ data: { ...data, email: i.email } });

  let affiliate;
  try {
    // Admin-added reps are approved straight away: that creates their login, referral link and discount code.
    affiliate = await createAffiliateFromSalesRepSignup(signup.id);
  } catch (err) {
    if (err instanceof SalesRepApprovalError) throw new AddError(err.message, err.status);
    throw err;
  }

  // The normal approval path leaves someone at the top level when their sponsor has recruiting turned off.
  // An admin choosing a sponsor means it, so place them there (the same override as dragging in the hierarchy).
  if (i.sponsorId && affiliate.parentAffiliateId !== i.sponsorId) {
    await prisma.affiliate.update({ where: { id: affiliate.id }, data: { parentAffiliateId: i.sponsorId } });
    await createNotification(i.sponsorId, {
      type: "recruit_joined",
      title: "Someone joined your team",
      body: `${affiliate.displayName ?? affiliate.userEmail} is now on your team.`,
    });
    warnings.push("Their sponsor has recruiting turned off, so they were placed under them as an admin override.");
  }

  const membership = await prisma.customerSignup.findFirst({
    where: { email: { equals: i.email, mode: "insensitive" }, plan: "agent" },
  });
  if (!membership) {
    warnings.push("The rep was added, but their Premium membership record could not be found.");
    return { id: affiliate.id, payLink: null, warnings };
  }

  if (i.billing === "free") {
    try {
      const res = await grantComplimentary(membership.id, { note: i.note, adminEmail: i.adminEmail });
      warnings.push(...res.warnings);
    } catch (err) {
      if (err instanceof MembershipError) {
        warnings.push(`The rep was added, but the free Premium membership could not be granted: ${err.message}`);
      } else throw err;
    }
    return { id: affiliate.id, payLink: null, warnings };
  }

  try {
    await notifyRepPaymentDue(membership);
  } catch (err) {
    console.error("Rep payment email failed", err);
    warnings.push("The rep was added, but the email with their payment link could not be sent.");
  }
  const payLink = payLinkFor(membership);
  if (!payLink) {
    warnings.push("Online payment is not set up, so no payment link was sent. Record their payments from the rep's details.");
  }
  return { id: affiliate.id, payLink, warnings };
}
