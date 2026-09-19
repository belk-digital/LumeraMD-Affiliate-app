import "dotenv/config";

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;
const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2025-07";

async function main() {
  // Find a real product/variant to order
  const productsRes = await fetch(
    `https://${STORE_DOMAIN}/admin/api/${API_VERSION}/products.json?limit=1`,
    { headers: { "X-Shopify-Access-Token": ACCESS_TOKEN } },
  );
  const products = await productsRes.json();
  const variant = products.products[0].variants[0];
  console.log("Using variant:", variant.id, variant.price);

  const orderRes = await fetch(
    `https://${STORE_DOMAIN}/admin/api/${API_VERSION}/orders.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ACCESS_TOKEN,
      },
      body: JSON.stringify({
        order: {
          line_items: [{ variant_id: variant.id, quantity: 1 }],
          email: "test-shopper@example.com",
          financial_status: "paid",
          discount_codes: [
            { code: "TESTAFF10", amount: "10.0", type: "percentage" },
          ],
        },
      }),
    },
  );

  const order = await orderRes.json();
  console.log(JSON.stringify(order, null, 2));
}

main().catch((err) => console.error(err));
