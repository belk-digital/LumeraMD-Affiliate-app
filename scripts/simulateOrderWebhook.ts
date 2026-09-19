import "dotenv/config";
import crypto from "node:crypto";

const payload = {
  id: Date.now(),
  name: "#TEST" + String(Date.now()).slice(-4),
  subtotal_price: "100.00",
  total_discounts: "10.00",
  discount_codes: [{ code: "TESTAFF10" }],
  email: "shopper@example.com",
  note_attributes: [],
};

const rawBody = JSON.stringify(payload);
const secret = process.env.SHOPIFY_WEBHOOK_SECRET!;
const hmac = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

fetch(`${process.env.WEBHOOK_BASE ?? "http://localhost:3100"}/api/shopify/webhooks/orders-paid`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Shopify-Hmac-Sha256": hmac,
  },
  body: rawBody,
})
  .then(async (res) => {
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
  })
  .catch((err) => console.error("Failed:", err));
