import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/shopify/verifyWebhook";
import { reverseConversion } from "@/lib/affiliates/commission";
import { handleRefund } from "@/lib/wallet/service";

interface ShopifyRefundPayload {
  id?: number;
  order_id: number;
  transactions?: { kind?: string; status?: string; amount?: string }[];
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");

  if (!verifyShopifyWebhook(rawBody, hmac)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const payload: ShopifyRefundPayload = JSON.parse(rawBody);
  const conversion = await reverseConversion(String(payload.order_id), "refund");

  // Wallet points follow the refund in proportion to the money refunded. Never let this fail the
  // webhook: Shopify would retry it, and the commission reversal above has already happened.
  let wallet: { clawedBackCents: number; returnedCents: number } | null = null;
  try {
    const refunds = (payload.transactions ?? []).filter(
      (t) => t.kind === "refund" && (t.status === undefined || t.status === "success"),
    );
    const refundedAmount = refunds.length > 0 ? refunds.reduce((sum, t) => sum + (parseFloat(t.amount ?? "0") || 0), 0) : null;
    wallet = await handleRefund({
      orderId: String(payload.order_id),
      refundId: String(payload.id ?? `order-${payload.order_id}`),
      refundedAmount,
    });
  } catch (err) {
    console.error("Wallet refund handling failed for order", payload.order_id, err);
  }

  return NextResponse.json({ ok: true, conversionId: conversion?.id ?? null, wallet });
}
