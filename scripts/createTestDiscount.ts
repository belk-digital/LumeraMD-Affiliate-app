import "dotenv/config";
import { createDiscountCode } from "../src/lib/shopify/client";

createDiscountCode({
  title: "Test Affiliate Discount",
  code: "TESTAFF10",
  valueType: "percentage",
  value: 10,
})
  .then((res) => console.log("Created:", JSON.stringify(res, null, 2)))
  .catch((err) => console.error("Failed:", err.message));
