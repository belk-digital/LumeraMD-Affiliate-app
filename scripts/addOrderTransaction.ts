import "dotenv/config";

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;
const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2025-07";
const ORDER_ID = 8908501188894;

fetch(
  `https://${STORE_DOMAIN}/admin/api/${API_VERSION}/orders/${ORDER_ID}/transactions.json`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": ACCESS_TOKEN,
    },
    body: JSON.stringify({
      transaction: {
        kind: "sale",
        status: "success",
        amount: "2.16",
        gateway: "manual",
      },
    }),
  },
)
  .then((r) => r.json())
  .then((data) => console.log(JSON.stringify(data, null, 2)));
