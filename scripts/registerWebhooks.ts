import "dotenv/config";
import { registerWebhook } from "../src/lib/shopify/client";

const base = "https://lumeramd-affiliates.vercel.app";

async function main() {
  const ordersPaid = await registerWebhook(
    "orders/paid",
    `${base}/api/shopify/webhooks/orders-paid`,
  );
  console.log("orders/paid:", JSON.stringify(ordersPaid));

  const refundsCreate = await registerWebhook(
    "refunds/create",
    `${base}/api/shopify/webhooks/refunds-create`,
  );
  console.log("refunds/create:", JSON.stringify(refundsCreate));
}

main().catch((err) => console.error("Failed:", err.message));
