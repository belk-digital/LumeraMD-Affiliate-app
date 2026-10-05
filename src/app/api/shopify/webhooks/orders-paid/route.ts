import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/shopify/verifyWebhook";
import { attributeOrder, type ShopifyOrderInput } from "@/lib/affiliates/commission";
import { handlePaidOrder } from "@/lib/wallet/service";

interface ShopifyOrderPayload {
  id: number;
  name: string;
  subtotal_price: string;
  /** Price of the line items before discounts (Shopify's subtotal_price is already after them). */
  total_line_items_price?: string;
  total_discounts: string;
  total_price?: string;
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

  // Wallet points are independent of affiliate attribution, and must never make this webhook fail
  // (Shopify would retry it and re-run the commission step). Anything that goes wrong is logged.
  let wallet: { earnedCents: number; redemptionUsed: boolean; reason: string } | null = null;
  try {
    const discountTotal = parseFloat(payload.total_discounts) || 0;
    const grossSubtotal = payload.total_line_items_price
      ? parseFloat(payload.total_line_items_price)
      : (parseFloat(payload.subtotal_price) || 0) + discountTotal;
    wallet = await handlePaidOrder({
      id: String(payload.id),
      name: payload.name,
      email: order.customerEmail,
      subtotal: grossSubtotal,
      discountTotal,
      total: parseFloat(payload.total_price ?? payload.subtotal_price) || 0,
      discountCodes: order.discountCodes,
    });
  } catch (err) {
    console.error("Wallet handling failed for order", payload.id, err);
  }

  return NextResponse.json({ ok: true, conversionId: conversion?.id ?? null, wallet });
}
