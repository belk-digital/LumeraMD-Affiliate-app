// Local stand-in for Authorize.net's webhook, which can't reach a development machine: takes the
// transaction id of a SANDBOX payment (shown on the payment page, and in the sandbox's Transaction
// Search) and processes it exactly as the webhook would. With --approve it first releases a payment
// that the fraud filters are holding for review. Never touches Shopify; emails are logged, not sent.
// Refuses to run unless AUTHNET_ENV is "sandbox" and the database is not production.
//
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx --env-file=.env.local scripts/replayAuthnetPayment.ts <transactionId> [--approve]
import "dotenv/config"; // does not override an already-exported DATABASE_URL
delete process.env.RESEND_API_KEY;
import { prisma } from "../src/lib/prisma";
import { handleAuthnetPayment } from "../src/lib/authnet/handlePayment";

async function main() {
  const transId = process.argv[2];
  if (!transId || transId.startsWith("--")) throw new Error("Usage: replayAuthnetPayment.ts <transactionId> [--approve]");
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  console.log("database host:", host);
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");
  if (process.env.AUTHNET_ENV !== "sandbox") throw new Error("Refusing to run: AUTHNET_ENV must be 'sandbox'.");

  if (process.argv.includes("--approve")) {
    const res = await fetch("https://apitest.authorize.net/xml/v1/request.api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updateHeldTransactionRequest: {
          merchantAuthentication: { name: process.env.AUTHNET_API_LOGIN_ID, transactionKey: process.env.AUTHNET_TRANSACTION_KEY },
          heldTransactionRequest: { action: "approve", refTransId: transId },
        },
      }),
    });
    const out = JSON.parse((await res.text()).replace(/^﻿/, ""));
    console.log("approve held payment:", JSON.stringify(out.messages));
  }

  const result = await handleAuthnetPayment(transId, { skipShopify: true });
  console.log("result:", JSON.stringify(result));
}

main()
  .catch((err) => {
    console.error("FAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
