import crypto from "node:crypto";
import dotenv from "dotenv";

// Prints a one-time admin login link for the LOCAL dev server (valid 15 minutes), so you can sign
// in without waiting for the email. Uses .env.local (the Neon testing branch) and refuses to run
// against production.
// Usage: pnpm dlx tsx scripts/adminLoginLink.ts [email] [port]
dotenv.config({ path: ".env.local" });
dotenv.config(); // fills anything .env.local doesn't set; never overrides it

const email = (process.argv[2] ?? "main.belkdigital@gmail.com").toLowerCase();
const port = process.argv[3] ?? "3000";

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  if (!host || host.includes("cold-forest")) {
    throw new Error(`Refusing to run: DATABASE_URL host "${host}" is not the testing branch.`);
  }
  // Imported after dotenv so the Prisma client picks up the testing DATABASE_URL.
  const { prisma } = await import("../src/lib/prisma");
  try {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.adminLoginToken.create({
      data: { email, token, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
    });
    console.log(`database: ${host}`);
    console.log(`http://localhost:${port}/api/lumera-ops/auth/callback?token=${token}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
