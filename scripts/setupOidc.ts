// One-time setup for single sign-on ("Sign in with LumeraMD"). Run it in YOUR OWN terminal; it prints
// secrets, so don't paste its output into a chat, ticket or email.
//
//   pnpm dlx tsx scripts/setupOidc.ts
//   pnpm dlx tsx scripts/setupOidc.ts --redirect https://portal.example/cb --post-logout https://portal.example/bye
//
// It makes a new signing key and a new client secret every time you run it. Put the four OIDC_* values
// in Vercel (Production, mark them Sensitive), redeploy, and send the portal's team the client secret
// through a one-time link. Running it again and replacing the values changes the key and the secret,
// which signs everyone out of the portal's sign-in and requires them to use the new secret.
import crypto from "node:crypto";

const DEFAULT_REDIRECT = "https://portal.lumeramd.com/auth/lumera/callback";

function option(name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < process.argv.length; i++) if (process.argv[i] === name && process.argv[i + 1]) out.push(process.argv[i + 1]);
  return out;
}

const redirects = option("--redirect");
const postLogouts = option("--post-logout");
const clientId = option("--client-id")[0] ?? "lumeramd-portal";

const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString().trim().replace(/\n/g, "\\n");
const secret = crypto.randomBytes(32).toString("base64url");
const secretHash = crypto.createHash("sha256").update(secret).digest("hex");

const lines = [
  "",
  "Add these in Vercel > Settings > Environment Variables (Production, Sensitive), then redeploy:",
  "",
  `OIDC_PRIVATE_KEY=${pem}`,
  `OIDC_CLIENT_SECRET_SHA256=${secretHash}`,
  `OIDC_REDIRECT_URIS=${(redirects.length ? redirects : [DEFAULT_REDIRECT]).join(",")}`,
  ...(postLogouts.length ? [`OIDC_POST_LOGOUT_URIS=${postLogouts.join(",")}`] : []),
  ...(clientId !== "lumeramd-portal" ? [`OIDC_CLIENT_ID=${clientId}`] : []),
  "",
  "Send the portal's team (through a one-time link, never plain email or chat):",
  "",
  `CLIENT SECRET: ${secret}`,
  "",
  `Client ID: ${clientId}`,
  "Token authentication: client_secret_basic (client_secret_post also works)",
  "",
  "The secret above is not stored anywhere, only its hash is. Clear this terminal when you are done.",
  "",
];
console.log(lines.join("\n"));
