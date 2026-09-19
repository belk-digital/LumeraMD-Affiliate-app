import "dotenv/config";
import crypto from "node:crypto";
import { prisma } from "../src/lib/prisma";

// Prints a one-time admin login link for the LOCAL dev server (valid 15 minutes).
// Usage: npx tsx scripts/adminLoginLink.ts [email] [port]
const email = process.argv[2] ?? "main.belkdigital@gmail.com";
const port = process.argv[3] ?? "3100";

async function main() {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.adminLoginToken.create({
    data: { email, token, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
  });
  console.log(`http://localhost:${port}/api/admin/auth/callback?token=${token}`);
}

main().finally(() => prisma.$disconnect());
