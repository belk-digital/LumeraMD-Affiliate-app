// A local, throwaway demo of "Sign in with LumeraMD", so you can click through it in a browser before
// anything is deployed. It starts:
//   - a private copy of this site on http://localhost:3100 with a throwaway signing key and secret
//     (your real settings are never touched, and no real email is sent: the sign-in link is printed here)
//   - a pretend portal on http://localhost:4000 that behaves like portal.lumeramd.com will
// It uses the DEV database, makes one demo member there, and removes it when you press Ctrl+C.
//
//   pnpm dlx tsx --env-file=.env.local scripts/demoSso.ts
//   pnpm dlx tsx --env-file=.env.local scripts/demoSso.ts --email you@example.com   (use an email you can read the link for)
import "dotenv/config";
import { spawn, execSync, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import http from "node:http";
import { prisma } from "../src/lib/prisma";

const SITE = "http://localhost:3100";
const PORTAL = "http://localhost:4000";
const CLIENT_ID = "lumeramd-portal";
const SECRET = crypto.randomBytes(24).toString("base64url");
const emailArg = process.argv.indexOf("--email") > -1 ? process.argv[process.argv.indexOf("--email") + 1] : undefined;

const say = (s = "") => process.stdout.write(`${s}\n`);
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const page = (title: string, body: string) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:8vh auto;padding:0 1.25rem;color:#1b222c;line-height:1.5">
<p style="background:#fff7e0;border:1px solid #f0d98a;border-radius:8px;padding:8px 12px;font-size:13px">
This is a <b>demo portal</b> on your own computer. It stands in for portal.lumeramd.com.</p>${body}</body>`;

const btn = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#17324E;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${esc(label)}</a>`;

interface Flow {
  verifier: string;
  nonce: string;
}
const flows = new Map<string, Flow>();
let lastIdToken = "";

function cookieOf(req: http.IncomingMessage, name: string) {
  return (req.headers.cookie ?? "")
    .split(";")
    .map((c) => c.trim().split("="))
    .find(([k]) => k === name)?.[1];
}

/** Checks the ID token the way the portal's developer should: signature, issuer, audience, expiry, nonce. */
async function verifyIdToken(idToken: string, nonce: string) {
  const [h, p, s] = idToken.split(".");
  const jwks = (await (await fetch(`${SITE}/.well-known/jwks.json`)).json()) as { keys: crypto.JsonWebKeyInput["key"][] };
  const key = crypto.createPublicKey({ key: jwks.keys[0], format: "jwk" });
  if (!crypto.verify("RSA-SHA256", Buffer.from(`${h}.${p}`), key, Buffer.from(s, "base64url"))) throw new Error("The ID token's signature is not valid.");
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  if (claims.iss !== SITE) throw new Error(`Wrong issuer: ${claims.iss}`);
  if (claims.aud !== CLIENT_ID) throw new Error(`Wrong audience: ${claims.aud}`);
  if (claims.exp < Date.now() / 1000) throw new Error("The ID token has expired.");
  if (claims.nonce !== nonce) throw new Error("The nonce does not match.");
  return claims as Record<string, unknown>;
}

function startPortal() {
  return http
    .createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", PORTAL);
      const send = (status: number, html: string, headers: Record<string, string> = {}) => {
        res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", ...headers });
        res.end(html);
      };
      try {
        if (url.pathname === "/") {
          return send(200, page("Demo portal", `<h1>Demo customer portal</h1><p>You are not signed in.</p>${btn("/login", "Sign in with LumeraMD")}`));
        }

        if (url.pathname === "/login") {
          const state = crypto.randomBytes(16).toString("base64url");
          const verifier = crypto.randomBytes(48).toString("base64url");
          const nonce = crypto.randomBytes(16).toString("base64url");
          flows.set(state, { verifier, nonce });
          const authorize = new URL(`${SITE}/oauth/authorize`);
          authorize.search = new URLSearchParams({
            response_type: "code",
            client_id: CLIENT_ID,
            redirect_uri: `${PORTAL}/auth/lumera/callback`,
            scope: "openid email profile",
            state,
            nonce,
            code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"),
            code_challenge_method: "S256",
          }).toString();
          // The state is also kept in a cookie: that's how a portal knows the sign-in began in this same browser.
          return send(302, "", { Location: authorize.toString(), "Set-Cookie": `flow=${state}; Path=/; HttpOnly; SameSite=Lax` });
        }

        if (url.pathname === "/auth/lumera/callback") {
          const state = url.searchParams.get("state") ?? "";
          const error = url.searchParams.get("error");
          if (error) return send(400, page("Sign-in failed", `<h1>Sign-in failed</h1><p><b>${esc(error)}</b>: ${esc(url.searchParams.get("error_description") ?? "")}</p>${btn("/", "Back")}`));
          const flow = flows.get(state);
          if (!flow || cookieOf(req, "flow") !== state) {
            return send(400, page("Start again", `<h1>Please start the sign-in again</h1><p>This sign-in was not started in this browser (or it has expired), so we can't finish it. This is what a member sees if they open the emailed link on a different device.</p>${btn("/login", "Try again")}`));
          }
          flows.delete(state);
          if (url.searchParams.get("iss") !== SITE) return send(400, page("Rejected", "<h1>Wrong issuer</h1>"));

          const tokenRes = await fetch(`${SITE}/oauth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${SECRET}`).toString("base64")}` },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              code: url.searchParams.get("code") ?? "",
              redirect_uri: `${PORTAL}/auth/lumera/callback`,
              code_verifier: flow.verifier,
            }),
          });
          const tokens = (await tokenRes.json()) as { id_token?: string; access_token?: string; error?: string; error_description?: string };
          if (!tokenRes.ok || !tokens.id_token) throw new Error(`${tokens.error}: ${tokens.error_description}`);
          const claims = await verifyIdToken(tokens.id_token, flow.nonce);
          lastIdToken = tokens.id_token;
          const info = await (await fetch(`${SITE}/oauth/userinfo`, { headers: { Authorization: `Bearer ${tokens.access_token}` } })).json();

          const rows = Object.entries(claims)
            .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666"><code>${esc(k)}</code></td><td><code>${esc(v)}</code></td></tr>`)
            .join("");
          return send(
            200,
            page(
              "Signed in",
              `<h1>Signed in as ${esc(claims.name ?? claims.email)}</h1>
               <p>The portal checked the signature, issuer, audience, expiry and nonce, and the sign-in is complete. <b>No second password.</b></p>
               <h3>What LumeraMD told the portal (ID token)</h3><table>${rows}</table>
               <h3>Same answer from the user-info address</h3><pre style="background:#0f1b2a;color:#e8eef4;padding:12px;border-radius:8px;overflow:auto">${esc(JSON.stringify(info, null, 2))}</pre>
               <p style="color:#666;font-size:14px">The token carries no plan or discount. The portal looks those up with the membership API.</p>
               <p>${btn("/logout", "Sign out of the portal and LumeraMD")}</p>`,
            ),
          );
        }

        if (url.pathname === "/logout") {
          const logout = new URL(`${SITE}/oauth/logout`);
          logout.search = new URLSearchParams({ id_token_hint: lastIdToken, post_logout_redirect_uri: `${PORTAL}/bye`, state: "demo" }).toString();
          return send(302, "", { Location: logout.toString() });
        }

        if (url.pathname === "/bye") {
          return send(200, page("Signed out", `<h1>Signed out</h1><p>You were sent back here by LumeraMD after it signed you out.</p>${btn("/", "Start again")}`));
        }

        return send(404, page("Not found", "<h1>Not found</h1>"));
      } catch (err) {
        return send(500, page("Error", `<h1>Something went wrong</h1><pre>${esc(err instanceof Error ? err.message : err)}</pre>${btn("/", "Back")}`));
      }
    })
    .listen(4000);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  const host = dbUrl.replace(/.*@([^/]+)\/.*/, "$1");
  if (!host || dbUrl === host || host.includes("cold-forest")) {
    throw new Error("Refusing to run: the database isn't the dev database. Run it with --env-file=.env.local");
  }

  // The demo member (made in the dev database, removed at the end unless it already existed).
  const email = emailArg ?? "demo-member@example.test";
  const existing = await prisma.customerSignup.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  const demo =
    existing ??
    (await prisma.customerSignup.create({
      data: { firstName: "Demo", lastName: "Member", email, plan: "customer_plus", status: "active", activatedAt: new Date() },
    }));

  const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const env = {
    ...process.env,
    APP_BASE_URL: SITE,
    OIDC_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString().replace(/\n/g, "\\n"),
    OIDC_CLIENT_SECRET_SHA256: crypto.createHash("sha256").update(SECRET).digest("hex"),
    OIDC_REDIRECT_URIS: `${PORTAL}/auth/lumera/callback`,
    OIDC_POST_LOGOUT_URIS: `${PORTAL}/bye`,
    RESEND_API_KEY: "", // never send real email from the demo; the link is printed below instead
    UPSTASH_REDIS_REST_URL: "",
    UPSTASH_REDIS_REST_TOKEN: "",
  };

  say(`Dev database: ${host}`);
  say("Starting a private copy of the site on port 3100 (the first page takes about 30 seconds to build)…");
  const server: ChildProcess = spawn("pnpm exec next dev -p 3100", { shell: true, env, stdio: ["ignore", "pipe", "pipe"] });
  const seen = new Set<string>();
  const onOutput = (chunk: Buffer) => {
    const text = chunk.toString();
    for (const m of text.matchAll(/http:\/\/localhost:3100\/api\/(?:customers|lumera-ops)\/auth\/callback\?token=[a-f0-9]+/g)) {
      if (seen.has(m[0])) continue;
      seen.add(m[0]);
      say();
      say("  >>> SIGN-IN LINK (open it in the SAME browser you're using for the demo):");
      say(`  ${m[0]}`);
      say();
    }
  };
  server.stdout?.on("data", onOutput);
  server.stderr?.on("data", onOutput);

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    say("\nStopping the demo and cleaning up…");
    try {
      if (process.platform === "win32" && server.pid) execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: "ignore" });
      else server.kill();
    } catch {
      /* already gone */
    }
    portal.close();
    await prisma.oidcGrant.deleteMany({ where: { customerId: demo.id } });
    await prisma.customerLoginToken.deleteMany({ where: { customerId: demo.id } });
    if (!existing) await prisma.customerSignup.deleteMany({ where: { id: demo.id } });
    await prisma.$disconnect();
    say("Done.");
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  server.on("exit", () => void stop());

  const portal = startPortal();

  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${SITE}/.well-known/openid-configuration`)).ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  say();
  say("==================== READY ====================");
  say(`1. Open the pretend portal:   ${PORTAL}`);
  say('2. Click "Sign in with LumeraMD".');
  say(`3. On the member login page, enter:  ${email}`);
  say("4. The sign-in link appears in THIS window (no email is sent). Open it in the same browser.");
  say("5. You are returned to the portal, signed in. Try signing out too.");
  say();
  say(`Also worth a look:   ${SITE}/developers        (the documentation page)`);
  say(`Admin card:          ${SITE}/lumera-ops/login  (enter your admin email; its link appears here too)`);
  say("                     then open API & webhooks, and look at the Single sign-on card.");
  say();
  say("Press Ctrl+C to stop and clean up.");
}

main().catch(async (err) => {
  console.error("\nFAILED:", err instanceof Error ? err.message : err);
  await prisma.$disconnect();
  process.exit(1);
});
