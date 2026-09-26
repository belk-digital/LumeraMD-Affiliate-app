import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// Disallows <, >, ", ' and other characters that could break out of HTML/attribute
// context when this address is later interpolated into outbound emails.
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const MAX_W9_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_W9_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);

// Applications ship as multipart/form-data (not JSON) because the signed W-9 rides along in the
// same request — it's uploaded to Neon Object Storage, never as a typed-in SSN/EIN.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const ipLimit = await checkRateLimit("affiliate-apply-ip", ip, 5, "1 h");
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "Too many applications from this network. Please try again later." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const str = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v : "";
  };

  const firstName = str("firstName").trim();
  const lastName = str("lastName").trim();
  const email = str("email").trim();
  const websiteUrl = str("websiteUrl").trim();
  const promotionMethods = str("promotionMethods").trim();
  const agreedToTerms = str("agreedToTerms") === "true";
  const referralSlug = str("referralSlug") || undefined;
  const w9File = form.get("w9File");

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Please enter your first and last name." }, { status: 400 });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }
  const emailLimit = await checkRateLimit("affiliate-apply-email", email.toLowerCase(), 3, "1 h");
  if (!emailLimit.ok) {
    return NextResponse.json(
      { error: "Too many applications submitted for this email. Please try again later." },
      { status: 429, headers: { "Retry-After": String(emailLimit.retryAfterSeconds) } },
    );
  }
  if (!agreedToTerms) {
    return NextResponse.json({ error: "You need to agree to the terms." }, { status: 400 });
  }
  if (!w9File || !(w9File instanceof File)) {
    return NextResponse.json({ error: "Please upload your signed W-9 form." }, { status: 400 });
  }
  if (!ALLOWED_W9_TYPES.has(w9File.type)) {
    return NextResponse.json(
      { error: "Please upload a PDF, PNG, or JPG of your signed W-9." },
      { status: 400 },
    );
  }
  if (w9File.size > MAX_W9_BYTES) {
    return NextResponse.json({ error: "That file is too large (8MB max)." }, { status: 400 });
  }

  const displayName = `${firstName} ${lastName}`;
  const cleanEmail = email;

  const existing = await prisma.affiliate.findFirst({
    where: { userEmail: { equals: cleanEmail, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json({ error: "This email is already an affiliate." }, { status: 409 });
  }

  // Who recruited this person? The invite link's slug wins, then the referral cookie.
  // Either way the referrer is looked up server-side; nothing about them is trusted from the client.
  const cookieAffiliateId = req.cookies.get("affiliate_ref")?.value;
  const referrer = referralSlug
    ? await prisma.affiliate.findUnique({ where: { referralSlug } })
    : cookieAffiliateId
      ? await prisma.affiliate.findUnique({ where: { id: cookieAffiliateId } })
      : null;
  const referredByAffiliateId =
    referrer &&
    referrer.status === "approved" &&
    referrer.userEmail.toLowerCase() !== cleanEmail.toLowerCase()
      ? referrer.id
      : null;

  const extension = w9File.name.includes(".") ? w9File.name.split(".").pop() : "pdf";
  const w9StorageKey = `w9-submissions/${randomUUID()}.${extension}`;
  await uploadFile(w9StorageKey, Buffer.from(await w9File.arrayBuffer()), w9File.type);

  const application = await prisma.affiliateApplication.create({
    data: {
      displayName,
      firstName,
      lastName,
      email: cleanEmail,
      websiteUrl: websiteUrl || undefined,
      promotionMethods: promotionMethods || undefined,
      agreedToTerms,
      w9StorageKey,
      w9FileName: w9File.name,
      w9FileType: w9File.type,
      referredByAffiliateId,
      status: "pending",
    },
  });

  return NextResponse.json({ ok: true, application: { id: application.id } });
}
