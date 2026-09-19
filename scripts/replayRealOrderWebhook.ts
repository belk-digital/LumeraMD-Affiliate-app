import "dotenv/config";
import crypto from "node:crypto";

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;
const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2025-07";
const ORDER_ID = 8908501188894;

async function main() {
  const res = await fetch(
    `https://${STORE_DOMAIN}/admin/api/${API_VERSION}/orders/${ORDER_ID}.json`,
    { headers: { "X-Shopify-Access-Token": ACCESS_TOKEN } },
  );
  const { order } = await res.json();

  const rawBody = JSON.stringify(order);
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET!;
  const hmac = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

  const webhookRes = await fetch(
    "https://lumeramd-affiliates.vercel.app/api/shopify/webhooks/orders-paid",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Hmac-Sha256": hmac,
      },
      body: rawBody,
    },
  );

  console.log("Status:", webhookRes.status);
  console.log("Body:", await webhookRes.text());
}

main().catch((err) => console.error(err));
