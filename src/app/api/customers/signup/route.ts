import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { EMAIL_RE, resolveReferrerId } from "@/lib/signup";
import { isCustomerPlanKey } from "@/lib/membership/plans";
import { notifyMembershipRequested } from "@/lib/email/membership";

// Records a customer's chosen membership as pending_payment. Recurring billing is what activates
// it, so nothing is charged or granted here.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const ipLimit = await checkRateLimit("customer-signup-ip", ip, 10, "1 h");
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "Too many signups from this network. Please try again later." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const str = (key: string, max = 200) =>
    typeof body[key] === "string" ? (body[key] as string).trim().slice(0, max) : "";

  const firstName = str("firstName", 100);
  const lastName = str("lastName", 100);
  const email = str("email");
  const phone = str("phone", 40);
  const plan = str("plan");
  const referralSlug = str("referralSlug") || undefined;

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Please enter your first and last name." }, { status: 400 });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }
  if (!isCustomerPlanKey(plan)) {
    return NextResponse.json({ error: "Please choose a membership plan." }, { status: 400 });
  }
  const emailLimit = await checkRateLimit("customer-signup-email", email.toLowerCase(), 5, "1 h");
  if (!emailLimit.ok) {
    return NextResponse.json(
      { error: "Too many signups for this email. Please try again later." },
      { status: 429, headers: { "Retry-After": String(emailLimit.retryAfterSeconds) } },
    );
  }

  // The $499 test kit rate is a Premium perk; anyone else buys it at web price.
  const wantsTestKit = body.wantsTestKit === true && plan === "customer_premium";

  const referredByAffiliateId = await resolveReferrerId(req, referralSlug, email);

  // One live membership per email. Someone who is already a member should log in rather than
  // sign up again; someone who hasn't paid yet just changes their request.
  const existing = await prisma.customerSignup.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, status: { not: "cancelled" } },
    orderBy: { createdAt: "desc" },
  });
  if (existing && existing.status !== "pending_payment") {
    return NextResponse.json(
      { error: "This email already has a membership. Log in to your account to see it." },
      { status: 409 },
    );
  }

  const signup = existing
    ? await prisma.customerSignup.update({
        where: { id: existing.id },
        data: { firstName, lastName, phone: phone || null, plan, wantsTestKit },
      })
    : await prisma.customerSignup.create({
        data: { firstName, lastName, email, phone: phone || undefined, plan, wantsTestKit, referredByAffiliateId },
      });

  if (!existing) {
    try {
      await notifyMembershipRequested(signup);
    } catch (err) {
      console.error("Membership request email failed", err);
    }
  }

  return NextResponse.json({ ok: true, signup: { id: signup.id } });
}
