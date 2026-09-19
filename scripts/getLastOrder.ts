import "dotenv/config";

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;
const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2025-07";

fetch(
  `https://${STORE_DOMAIN}/admin/api/${API_VERSION}/orders.json?limit=1&order=created_at desc&status=any`,
  { headers: { "X-Shopify-Access-Token": ACCESS_TOKEN } },
)
  .then((r) => r.json())
  .then((data) => console.log(JSON.stringify(data.orders[0], null, 2)));
