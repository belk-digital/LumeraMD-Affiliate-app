import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customers/session";
import { checkRateLimit } from "@/lib/rateLimit";

// A signed-in member updates their own name and phone. Email is the login identity, so it is not editable here.
export async function PATCH(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const limit = await checkRateLimit("customer-profile", session.customerId, 20, "1 h");
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many changes. Please try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "First and last name are required." }, { status: 400 });
  }
  if (firstName.length > 80 || lastName.length > 80 || phone.length > 40) {
    return NextResponse.json({ error: "One of the fields is too long." }, { status: 400 });
  }
  if (phone && !/^[0-9+()\-.\s]{7,40}$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }

  await prisma.customerSignup.update({
    where: { id: session.customerId },
    data: { firstName, lastName, phone: phone || null },
  });
  return NextResponse.json({ ok: true });
}
