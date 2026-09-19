import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/shopify/verifyWebhook";
import { reverseConversion } from "@/lib/affiliates/commission";

interface ShopifyRefundPayload {
  order_id: number;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");

  if (!verifyShopifyWebhook(rawBody, hmac)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const payload: ShopifyRefundPayload = JSON.parse(rawBody);
  const conversion = await reverseConversion(String(payload.order_id), "refund");

  return NextResponse.json({ ok: true, conversionId: conversion?.id ?? null });
}
