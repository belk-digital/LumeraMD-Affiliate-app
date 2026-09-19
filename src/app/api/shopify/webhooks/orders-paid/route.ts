import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/shopify/verifyWebhook";
import { attributeOrder, type ShopifyOrderInput } from "@/lib/affiliates/commission";

interface ShopifyOrderPayload {
  id: number;
  name: string;
  subtotal_price: string;
  total_discounts: string;
  discount_codes: { code: string }[];
  email: string | null;
  customer?: { email?: string } | null;
  note_attributes?: { name: string; value: string }[];
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");

  if (!verifyShopifyWebhook(rawBody, hmac)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const payload: ShopifyOrderPayload = JSON.parse(rawBody);

  const order: ShopifyOrderInput = {
    id: String(payload.id),
    name: payload.name,
    subtotalPrice: parseFloat(payload.subtotal_price),
    totalDiscounts: parseFloat(payload.total_discounts),
    discountCodes: payload.discount_codes.map((d) => d.code),
    customerEmail: payload.email ?? payload.customer?.email ?? null,
  };

  const noteAttrs = Object.fromEntries(
    (payload.note_attributes ?? []).map((a) => [a.name, a.value]),
  );

  const conversion = await attributeOrder({
    order,
    cookieAffiliateId: noteAttrs.affiliate_ref ?? null,
    cookieClickId: noteAttrs.affiliate_click_id ?? null,
  });

  return NextResponse.json({ ok: true, conversionId: conversion?.id ?? null });
}
