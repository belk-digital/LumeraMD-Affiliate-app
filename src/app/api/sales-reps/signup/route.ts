import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { EMAIL_RE, resolveReferrerId } from "@/lib/signup";
import { notifyAdminNewSalesRep } from "@/lib/email/admin";
import { PLANS, type PlanKey } from "@/lib/membership/plans";

const MAX_RESUME_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_RESUME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

// Sales rep signups ship as multipart/form-data so the optional resume rides along in the same
// request. Only an email is required — a resume can stand in for the rest of the form.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const ipLimit = await checkRateLimit("sales-rep-signup-ip", ip, 5, "1 h");
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "Too many signups from this network. Please try again later." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const str = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v.trim() : "";
  };

  const firstName = str("firstName").slice(0, 100);
  const lastName = str("lastName").slice(0, 100);
  const email = str("email");
  const phone = str("phone").slice(0, 40);
  const salesType = str("salesType").slice(0, 200);
  const annualGrossSalesRaw = str("annualGrossSales").replace(/[$,\s]/g, "");
  const plan = str("plan") || "agent";
  const referralSlug = str("referralSlug") || undefined;
  const resume = form.get("resume");

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }
  if (!firstName) {
    return NextResponse.json({ error: "Please enter your first name." }, { status: 400 });
  }
  if (!lastName) {
    return NextResponse.json({ error: "Please enter your last name." }, { status: 400 });
  }
  const phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length < 7 || phoneDigits.length > 15) {
    return NextResponse.json({ error: "Please enter a valid phone number." }, { status: 400 });
  }
  if (plan !== "agent") {
    return NextResponse.json({ error: "Please choose a plan." }, { status: 400 });
  }
  const emailLimit = await checkRateLimit("sales-rep-signup-email", email.toLowerCase(), 3, "1 h");
  if (!emailLimit.ok) {
    return NextResponse.json(
      { error: "Too many signups for this email. Please try again later." },
      { status: 429, headers: { "Retry-After": String(emailLimit.retryAfterSeconds) } },
    );
  }

  let annualGrossSales: number | null = null;
  if (annualGrossSalesRaw) {
    annualGrossSales = Number(annualGrossSalesRaw);
    if (!Number.isFinite(annualGrossSales) || annualGrossSales < 0 || annualGrossSales > 1e10) {
      return NextResponse.json({ error: "Please enter a valid annual sales amount." }, { status: 400 });
    }
  }

  let resumeData: { key: string; name: string; type: string } | null = null;
  if (resume instanceof File && resume.size > 0) {
    const ext = ALLOWED_RESUME_TYPES[resume.type];
    if (!ext) {
      return NextResponse.json({ error: "Please upload your resume as a PDF or Word document." }, { status: 400 });
    }
    if (resume.size > MAX_RESUME_BYTES) {
      return NextResponse.json({ error: "That file is too large (8MB max)." }, { status: 400 });
    }
    const key = `sales-rep-resumes/${randomUUID()}.${ext}`;
    await uploadFile(key, Buffer.from(await resume.arrayBuffer()), resume.type);
    resumeData = { key, name: resume.name.slice(0, 200), type: resume.type };
  }

  const referredByAffiliateId = await resolveReferrerId(req, referralSlug, email, { forTeam: true });

  const signup = await prisma.salesRepSignup.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      plan,
      annualGrossSales,
      salesType: salesType || undefined,
      resumeStorageKey: resumeData?.key,
      resumeFileName: resumeData?.name,
      resumeFileType: resumeData?.type,
      referredByAffiliateId,
    },
  });

  // Tell the admins an application is waiting. Never fails the signup if the email does.
  try {
    const referrer = referredByAffiliateId
      ? await prisma.affiliate.findUnique({
          where: { id: referredByAffiliateId },
          select: { displayName: true, userEmail: true },
        })
      : null;
    await notifyAdminNewSalesRep({
      firstName,
      lastName,
      email,
      planName: PLANS[plan as PlanKey]?.name ?? plan,
      referrer: referrer ? (referrer.displayName ?? referrer.userEmail) : null,
    });
  } catch (err) {
    console.error("Admin signup email failed", err);
  }

  return NextResponse.json({ ok: true, signup: { id: signup.id } });
}
