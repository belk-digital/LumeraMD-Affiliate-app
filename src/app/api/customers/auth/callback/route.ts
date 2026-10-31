import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setCustomerSessionCookie } from "@/lib/customers/session";
import { safeOidcNext } from "@/lib/oidc/next";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const token = req.nextUrl.searchParams.get("token");

  if (!token) return NextResponse.redirect(`${origin}/account/login?error=invalid_token`);

  const record = await prisma.customerLoginToken.findUnique({ where: { token } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.redirect(`${origin}/account/login?error=invalid_token`);
  }

  const customer = await prisma.customerSignup.findUnique({ where: { id: record.customerId } });
  if (!customer) {
    return NextResponse.redirect(`${origin}/account/login?error=invalid_token`);
  }

  await prisma.customerLoginToken.update({
    where: { token },
    data: { usedAt: new Date() },
  });

  await setCustomerSessionCookie({ customerId: customer.id, email: customer.email });

  // A sign-in that started on another site carries on from where it left off; otherwise the account page.
  return NextResponse.redirect(`${origin}${safeOidcNext(record.next) ?? "/account"}`);
}
