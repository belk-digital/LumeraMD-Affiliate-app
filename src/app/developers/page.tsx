import type { Metadata } from "next";
import CodeBlock from "./CodeBlock";
import { oidcClientId } from "@/lib/oidc/config";

// Public documentation for the customer portal integration. It holds no secrets: keys and signing
// secrets are given to the client privately. Kept out of search results.
export const metadata: Metadata = {
  title: "Membership API · LumeraMD",
  description: "Look up LumeraMD members and receive signed notifications when memberships change.",
  robots: { index: false, follow: false },
};

const BASE = (process.env.APP_BASE_URL || "https://lumeramd.biz").replace(/\/$/, "");

const MEMBER_EXAMPLE = `{
  "member": {
    "id": "cmvt3us03000106lc7vihv9rx",
    "email": "jane@example.com",
    "tier": "plus",
    "tier_name": "Plus",
    "status": "active",
    "payment_status": "paid",
    "paid_through": "2026-11-29T05:30:56.000Z",
    "complimentary": false,
    "discount_eligible": true,
    "web_discount_percent": 10,
    "activated_at": "2026-10-29T05:30:56.000Z",
    "cancelled_at": null,
    "updated_at": "2026-10-29T05:30:56.000Z"
  }
}`;

const LIST_EXAMPLE = `{
  "members": [ { "id": "...", "email": "...", "tier": "basic" }, { "id": "..." } ],
  "next_cursor": "MjAyNi0xMC0yOVQwNTozMDo1Ni4wMDBafGNtdnQzdXMw"
}`;

const WEBHOOK_EXAMPLE = `POST /your/webhook/path HTTP/1.1
Content-Type: application/json
User-Agent: LumeraMD-Webhooks/1
X-Lumera-Delivery: cmvt7qgdy000kwsvqab8ygsmx
X-Lumera-Attempt: 1
X-Lumera-Signature: t=1793250000,v1=5f3c9e...e91a

{
  "id": "cmvt7qgdy000kwsvqab8ygsmx",
  "type": "membership.payment_succeeded",
  "created": 1793250000,
  "data": {
    "member": { "id": "cmvt3us03000106lc7vihv9rx", "payment_status": "paid", "..." : "..." },
    "payment": {
      "id": "cmvt7qgdx000jwsvqe0ikq2y8",
      "amount": 49,
      "currency": "USD",
      "paid_at": "2026-10-29T05:30:56.000Z",
      "period_start": "2026-10-29T05:30:56.000Z",
      "period_end": "2026-11-29T05:30:56.000Z",
      "first_payment": true
    }
  }
}`;

const NODE_VERIFY = [
  'import crypto from "node:crypto";',
  "",
  "// rawBody: the request body exactly as received (a string or Buffer), not re-serialised JSON.",
  "export function verify(rawBody, header, secret) {",
  '  const t = /t=(\\d+)/.exec(header ?? "")?.[1];',
  '  const v1 = /v1=([0-9a-f]+)/.exec(header ?? "")?.[1];',
  "  if (!t || !v1) return false;",
  "  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // older than 5 minutes",
  "  const expected = crypto",
  '    .createHmac("sha256", secret)',
  '    .update(t + "." + rawBody)',
  '    .digest("hex");',
  "  return (",
  "    expected.length === v1.length &&",
  "    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1))",
  "  );",
  "}",
].join("\n");

const PY_VERIFY = [
  "import hmac, hashlib, re, time",
  "",
  "# raw_body: the request body exactly as received (bytes), not re-serialised JSON.",
  "def verify(raw_body: bytes, header: str, secret: str) -> bool:",
  '    t = re.search(r"t=(\\d+)", header or "")',
  '    v1 = re.search(r"v1=([0-9a-f]+)", header or "")',
  "    if not t or not v1 or abs(time.time() - int(t.group(1))) > 300:",
  "        return False",
  '    signed = t.group(1).encode() + b"." + raw_body',
  "    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()",
  "    return hmac.compare_digest(expected, v1.group(1))",
].join("\n");

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "authentication", label: "Authentication" },
  { id: "member", label: "The member object" },
  { id: "endpoints", label: "Endpoints" },
  { id: "webhooks", label: "Webhooks" },
  { id: "verifying", label: "Verifying a webhook" },
  { id: "retries", label: "Retries and duplicates" },
  { id: "sso", label: "Single sign-on" },
  { id: "not-yet", label: "Not covered yet" },
];

const SSO_AUTHORIZE = `GET ${BASE}/oauth/authorize
  ?response_type=code
  &client_id=${oidcClientId()}
  &redirect_uri=https%3A%2F%2Fportal.lumeramd.com%2Fauth%2Flumera%2Fcallback
  &scope=openid%20email
  &state=<random value you keep>
  &nonce=<random value you keep>
  &code_challenge=<base64url(SHA-256(code_verifier))>
  &code_challenge_method=S256`;

const SSO_TOKEN = `curl -X POST ${BASE}/oauth/token \\
  -u "${oidcClientId()}:$LUMERA_CLIENT_SECRET" \\
  -d grant_type=authorization_code \\
  -d code=<the code you received> \\
  -d redirect_uri=https://portal.lumeramd.com/auth/lumera/callback \\
  -d code_verifier=<the verifier you kept>`;

const SSO_ID_TOKEN = `{
  "iss": "${BASE}",
  "aud": "${oidcClientId()}",
  "sub": "cmvt3us03000106lc7vihv9rx",
  "email": "jane@example.com",
  "email_verified": true,
  "nonce": "<the nonce you sent>",
  "iat": 1793250000,
  "exp": 1793250600
}`;

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 border-b border-line pb-3 font-heading text-2xl font-bold text-ink">
      {children}
    </h2>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-primary-light px-1.5 py-0.5 font-mono text-[13px] text-primary">{children}</code>;
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line bg-page-bg/60 text-xs font-semibold text-ink/60">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((cells, i) => (
            <tr key={i} className="align-top">
              {cells.map((cell, j) => (
                <td key={j} className={`px-4 py-3 ${j === 0 ? "whitespace-nowrap font-medium text-ink" : "text-ink/75"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Endpoint({ path, title, children }: { path: string; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold tracking-wide text-emerald-700">GET</span>
        <code className="break-all font-mono text-sm font-semibold text-ink">{path}</code>
      </div>
      <h3 className="font-heading text-lg font-bold text-ink">{title}</h3>
      {children}
    </div>
  );
}

const P = ({ children }: { children: React.ReactNode }) => <p className="leading-relaxed text-ink/75">{children}</p>;

export default function DevelopersPage() {
  const curl = (path: string) => `curl -H "Authorization: Bearer $LUMERA_API_KEY" \\\n  "${BASE}${path}"`;
  const nodeGet = (path: string) =>
    `const res = await fetch("${BASE}${path}", {\n  headers: { Authorization: "Bearer " + process.env.LUMERA_API_KEY },\n});\nconst data = await res.json();`;
  const pyGet = (path: string) =>
    `import os, requests\n\nres = requests.get(\n    "${BASE}${path}",\n    headers={"Authorization": "Bearer " + os.environ["LUMERA_API_KEY"]},\n)\ndata = res.json()`;
  const samples = (path: string) => [
    { label: "curl", code: curl(path) },
    { label: "Node.js", code: nodeGet(path) },
    { label: "Python", code: pyGet(path) },
  ];

  return (
    <div className="min-h-screen bg-page-bg text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <span className="font-heading text-lg font-bold text-primary">LumeraMD</span>
          <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">Membership API · v1</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:px-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ul className="sticky top-6 space-y-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded-lg px-3 py-1.5 text-ink/60 transition hover:bg-white hover:text-primary">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 space-y-12">
          <section className="space-y-4">
            <H2 id="overview">Overview</H2>
            <P>
              Use this to connect your customer portal to LumeraMD memberships, so paid members automatically get their
              discount at checkout. There are two parts, and you can use either or both:
            </P>
            <ul className="list-disc space-y-1.5 pl-5 text-ink/75">
              <li>
                A <strong>read-only API</strong> you call to check a member&apos;s tier, payment status and paid-through date.
              </li>
              <li>
                <strong>Webhooks</strong> we send to you the moment a membership changes.
              </li>
            </ul>
            <P>
              Base URL: <Code>{BASE}</Code>. Everything is JSON over HTTPS, and every timestamp is ISO 8601 in UTC.
            </P>
          </section>

          <section className="space-y-4">
            <H2 id="authentication">Authentication</H2>
            <P>Every API request carries a key that LumeraMD gives you:</P>
            <CodeBlock samples={[{ label: "Header", code: "Authorization: Bearer lmd_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }]} />
            <P>
              Keep the key on your server. Never put it in browser or mobile app code. We store only a fingerprint of it, so
              it cannot be recovered: if you lose it, we issue a new one and revoke the old one. A revoked key stops working
              immediately.
            </P>
            <Table
              head={["Status", "Meaning"]}
              rows={[
                [<Code key="s">401</Code>, "The key is missing, wrong or has been revoked."],
                [<Code key="s">429</Code>, <>Too many requests (limit: 300 per minute). Wait the number of seconds in the <Code>Retry-After</Code> header.</>],
              ]}
            />
            <P>Responses are never cached (<Code>Cache-Control: no-store</Code>).</P>
          </section>

          <section className="space-y-4">
            <H2 id="member">The member object</H2>
            <CodeBlock samples={[{ label: "JSON", code: MEMBER_EXAMPLE }]} />
            <Table
              head={["Field", "Meaning"]}
              rows={[
                [<Code key="f">id</Code>, "Stable member id. Use this as the key on your side."],
                [<Code key="f">email</Code>, "The member's email."],
                [<Code key="f">tier</Code>, <><Code>basic</Code>, <Code>plus</Code>, <Code>premium</Code> or <Code>sales_rep</Code> (a LumeraMD sales rep&apos;s own Premium membership).</>],
                [<Code key="f">tier_name</Code>, "Display name of the tier."],
                [<Code key="f">status</Code>, <><Code>pending_payment</Code>, <Code>active</Code>, <Code>past_due</Code> or <Code>cancelled</Code>.</>],
                [<Code key="f">payment_status</Code>, "The payment state. See the table below."],
                [<Code key="f">paid_through</Code>, <>When the period they paid for ends. <Code>null</Code> for complimentary members and for people who never paid.</>],
                [<Code key="f">complimentary</Code>, <><Code>true</Code> if LumeraMD granted free access. These members never expire.</>],
                [<Code key="f">discount_eligible</Code>, <><strong>Whether to give the member discount right now.</strong> <Code>true</Code> when <Code>status</Code> is <Code>active</Code>.</>],
                [<Code key="f">web_discount_percent</Code>, "The percentage off web pricing for their tier."],
                [<Code key="f">activated_at</Code>, "When they first became a member."],
                [<Code key="f">cancelled_at</Code>, <>When they cancelled, or <Code>null</Code>.</>],
                [<Code key="f">updated_at</Code>, "When this record last changed."],
              ]}
            />
            <h3 className="pt-2 font-heading text-lg font-bold text-ink">payment_status</h3>
            <Table
              head={["Value", "Meaning", "Discount?"]}
              rows={[
                [<Code key="v">paid</Code>, "Active, current period paid.", "Yes"],
                [<Code key="v">complimentary</Code>, "Active, granted free by LumeraMD.", "Yes"],
                [<Code key="v">grace</Code>, "The period ended less than 3 days ago and payment is late. Still treated as a member.", "Yes"],
                [<Code key="v">past_due</Code>, "The grace period is over and no payment arrived.", "No"],
                [<Code key="v">unpaid</Code>, "Signed up but never paid.", "No"],
                [<Code key="v">cancelled</Code>, "Membership ended.", "No"],
              ]}
            />
          </section>

          <section className="space-y-5">
            <H2 id="endpoints">Endpoints</H2>

            <Endpoint path="/api/v1/members?email={email}" title="Look up a member by email">
              <P>
                Email matching ignores letter case. If the same email has had more than one membership you get the current
                one, or the most recent cancelled one if there is no current one. Returns <Code>404</Code> with{" "}
                <Code>{'{ "error": "not_found" }'}</Code> if there is none.
              </P>
              <CodeBlock samples={samples("/api/v1/members?email=jane@example.com")} />
            </Endpoint>

            <Endpoint path="/api/v1/members/{id}" title="Look up a member by id">
              <P>Returns the same <Code>member</Code> object, or <Code>404</Code>.</P>
              <CodeBlock samples={samples("/api/v1/members/cmvt3us03000106lc7vihv9rx")} />
            </Endpoint>

            <Endpoint path="/api/v1/members?updated_since={time}&limit={n}" title="List members that changed">
              <P>
                Members whose record changed at or after the time you give, oldest first. <Code>limit</Code> is 1 to 500
                (default 100). When <Code>next_cursor</Code> is not <Code>null</Code> there is more: ask for the next page with{" "}
                <Code>?cursor=&#123;next_cursor&#125;&amp;limit={"{n}"}</Code>. The same member can appear again if you ask from an
                earlier time, so de-duplicate on <Code>id</Code>.
              </P>
              <CodeBlock samples={samples("/api/v1/members?updated_since=2026-10-29T00:00:00Z&limit=100")} />
              <CodeBlock samples={[{ label: "Response", code: LIST_EXAMPLE }]} />
              <P>
                To keep your own copy in sync by polling, remember the newest <Code>updated_at</Code> you have seen and ask for
                changes since then every few minutes. Webhooks make this faster but are not required.
              </P>
            </Endpoint>
          </section>

          <section className="space-y-4">
            <H2 id="webhooks">Webhooks</H2>
            <P>We send an HTTPS <Code>POST</Code> to the address you give us whenever a membership changes.</P>
            <Table
              head={["Event type", "Sent when"]}
              rows={[
                [<Code key="e">membership.payment_succeeded</Code>, "A payment was received: a first payment, a monthly renewal, or a late payment that brings someone back."],
                [<Code key="e">membership.cancelled</Code>, "The membership was cancelled."],
                [<Code key="e">membership.expired</Code>, "Payment did not arrive and the 3-day grace period ended. Withdraw the discount."],
                [<Code key="e">membership.complimentary_granted</Code>, "LumeraMD granted free access."],
                [<Code key="e">test.ping</Code>, "A test notification with no member data, sent on request so you can check your set-up."],
              ]}
            />
            <CodeBlock samples={[{ label: "Request", code: WEBHOOK_EXAMPLE }]} />
            <P>
              <Code>data.payment</Code> appears only on <Code>membership.payment_succeeded</Code>. <Code>data.member</Code> is
              the member&apos;s state <strong>after</strong> the change, so you can simply store it. Ignore any event{" "}
              <Code>type</Code> you do not recognise: we may add more.
            </P>
          </section>

          <section className="space-y-4">
            <H2 id="verifying">Verifying a webhook</H2>
            <P>
              Check every request before you trust it. We sign the exact bytes of the body with a secret that only you and we
              know.
            </P>
            <ol className="list-decimal space-y-1.5 pl-5 text-ink/75">
              <li>
                Read <Code>X-Lumera-Signature</Code>: <Code>t=&lt;unix seconds&gt;,v1=&lt;hex signature&gt;</Code>.
              </li>
              <li>
                Build the string <Code>&quot;&lt;t&gt;.&lt;raw request body&gt;&quot;</Code> using the body exactly as received.
              </li>
              <li>Compute HMAC-SHA256 of it with your webhook secret, as lowercase hex.</li>
              <li>Compare with <Code>v1</Code> using a constant-time comparison.</li>
              <li>Reject the request if <Code>t</Code> is more than 5 minutes from your clock, so an old message can&apos;t be replayed.</li>
            </ol>
            <CodeBlock
              samples={[
                { label: "Node.js", code: NODE_VERIFY },
                { label: "Python", code: PY_VERIFY },
              ]}
            />
          </section>

          <section className="space-y-4">
            <H2 id="retries">Retries and duplicates</H2>
            <ul className="list-disc space-y-1.5 pl-5 text-ink/75">
              <li>
                Reply with any <Code>2xx</Code> status within 5 seconds to confirm receipt, and do your processing afterwards.
              </li>
              <li>
                Anything else (another status, a redirect, a timeout) counts as a failure. We try up to 8 times in total,
                waiting longer each time: about 1 minute, 5 minutes, 30 minutes, 2 hours, 6 hours, then a day between the last
                attempts. A retry has the same <Code>X-Lumera-Delivery</Code> and <Code>id</Code> and a higher{" "}
                <Code>X-Lumera-Attempt</Code>.
              </li>
              <li>
                Retries are checked when the next event happens and once a day, so a long outage can mean a long delay. Use
                the <Code>updated_since</Code> list to catch up after any downtime.
              </li>
              <li>
                <strong>Expect duplicates and out-of-order delivery.</strong> De-duplicate on <Code>id</Code>. When two events
                for one member arrive in the wrong order, trust the one with the later <Code>data.member.updated_at</Code>.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <H2 id="sso">Single sign-on (&ldquo;Sign in with LumeraMD&rdquo;)</H2>
            <P>
              Members sign in to their LumeraMD membership with an emailed one-time link. Your portal can offer &ldquo;Sign in with
              LumeraMD&rdquo; so a member does not need a second password: we are an OpenID Connect provider, using the
              authorization code flow with PKCE. It is for customers with a membership. Sales reps have a separate login and are not
              included.
            </P>
            <Table
              head={["Setting", "Value"]}
              rows={[
                ["Issuer", <Code key="v">{BASE}</Code>],
                ["Discovery address", <Code key="v">{BASE}/.well-known/openid-configuration</Code>],
                ["Client ID", <Code key="v">{oidcClientId()}</Code>],
                ["Client secret", "Given to you once, privately. We keep only a hash of it, so it can't be looked up."],
                [
                  "Token authentication",
                  <>
                    <Code>client_secret_basic</Code> (the secret in an <Code>Authorization: Basic</Code> header). <Code>client_secret_post</Code> also works.
                  </>,
                ],
                ["PKCE", <>Required: <Code>S256</Code> only.</>],
                ["Scopes", <><Code>openid</Code> (required), <Code>email</Code>, <Code>profile</Code>.</>],
                ["ID token signature", <><Code>RS256</Code>. Keys are published at <Code>{BASE}/.well-known/jwks.json</Code>.</>],
                ["Return addresses", "Only the addresses we registered for you, matched exactly."],
              ]}
            />

            <h3 className="pt-2 font-heading text-lg font-bold text-ink">The flow</h3>
            <ol className="list-decimal space-y-1.5 pl-5 text-ink/75">
              <li>
                Your portal sends the member&apos;s browser to our authorization address, with a fresh <Code>state</Code>,{" "}
                <Code>nonce</Code> and PKCE challenge.
              </li>
              <li>
                If they are not signed in to LumeraMD they enter their email and open the link we send them. We then bring them
                straight back to finish. If they already are, they come straight back with no extra step.
              </li>
              <li>
                We redirect to your return address with a one-time <Code>code</Code> (valid for about one minute), your{" "}
                <Code>state</Code>, and <Code>iss</Code>. Check <Code>state</Code> and <Code>iss</Code>.
              </li>
              <li>
                Your <strong>server</strong> swaps the code for tokens. Check the ID token&apos;s signature, <Code>iss</Code>,{" "}
                <Code>aud</Code>, <Code>exp</Code> and <Code>nonce</Code>, then sign the member in to your portal.
              </li>
            </ol>
            <CodeBlock samples={[{ label: "1. Send the member here", code: SSO_AUTHORIZE }]} />
            <CodeBlock samples={[{ label: "4. Swap the code", code: SSO_TOKEN }]} />

            <h3 className="pt-2 font-heading text-lg font-bold text-ink">The ID token</h3>
            <CodeBlock samples={[{ label: "Claims", code: SSO_ID_TOKEN }]} />
            <Table
              head={["Claim", "Meaning"]}
              rows={[
                [<Code key="c">sub</Code>, <>The member&apos;s id: the same <Code>id</Code> the membership API returns. Save it.</>],
                [<Code key="c">email</Code>, "The member's email. It is verified: they proved they control it by opening our emailed link."],
                [<Code key="c">email_verified</Code>, <>Always <Code>true</Code>.</>],
                [<Code key="c">name</Code>, <>With the <Code>profile</Code> scope: also <Code>given_name</Code> and <Code>family_name</Code>.</>],
                [<Code key="c">nonce</Code>, "The value you sent, if any."],
                [<Code key="c">exp</Code>, "The token is valid for 10 minutes. Use it once, to sign the member in."],
              ]}
            />
            <ul className="list-disc space-y-1.5 pl-5 text-ink/75">
              <li>
                <strong>The token says who the member is, not what they have.</strong> It carries no plan, tier or discount. Look
                those up through the membership API, which stays the source of truth.
              </li>
              <li>
                A member who cancels and later rejoins gets a new membership record, so their <Code>sub</Code> can change. Match on{" "}
                <Code>email</Code> as well, as you already do for the API.
              </li>
              <li>
                The access token is for the <Code>userinfo</Code> address only (<Code>{BASE}/oauth/userinfo</Code>), which returns the
                same claims. It lasts an hour. There are no refresh tokens.
              </li>
              <li>
                If a code is presented twice we reject it and cancel the tokens it produced, so keep each code to a single exchange.
              </li>
            </ul>

            <h3 className="pt-2 font-heading text-lg font-bold text-ink">Signing out</h3>
            <P>
              Signing out of your portal does not sign the member out of LumeraMD by itself. To do both, send their browser to{" "}
              <Code>{BASE}/oauth/logout</Code> with <Code>id_token_hint</Code> (the ID token we issued) and, if you want them returned to
              your portal, <Code>post_logout_redirect_uri</Code> and <Code>state</Code>. The return address must be one we registered for
              you. Without one, the member sees a &ldquo;signed out&rdquo; page on our site. We do not notify you when a member signs out
              on our side (there is no back-channel logout).
            </P>

            <h3 className="pt-2 font-heading text-lg font-bold text-ink">Good to know</h3>
            <ul className="list-disc space-y-1.5 pl-5 text-ink/75">
              <li>
                <strong>The emailed link has to be opened in the same browser</strong> that started the sign-in, so your
                <Code>state</Code> and PKCE verifier are still there when the member comes back. If they open it on another device
                they are signed in to LumeraMD, but your portal will need them to start again. Showing a clear message and a
                &ldquo;try again&rdquo; button is enough.
              </li>
              <li>
                <Code>prompt=none</Code> is supported: if the member is not signed in you get <Code>error=login_required</Code>.
              </li>
              <li>
                Errors come back to your return address as <Code>error</Code> and <Code>error_description</Code>, with your{" "}
                <Code>state</Code>. A request with an unknown client or an unregistered return address is never redirected: the
                member sees an error page on our site instead.
              </li>
              <li>
                Testing: tell us the email of a test member and we will make sure it can sign in. They sign in with the emailed link
                like anyone else.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <H2 id="not-yet">Not covered yet</H2>
            <ul className="list-disc space-y-1.5 pl-5 text-ink/75">
              <li>
                <strong>Plan changes.</strong> A change of tier is made by LumeraMD staff on request today. The new tier shows
                in the API straight away (<Code>updated_at</Code> changes), but no webhook is sent for it yet.
              </li>
              <li>
                <strong>Failed payments.</strong> A card that fails to renew is not reported separately. The member moves to{" "}
                <Code>past_due</Code> after the grace period and you receive <Code>membership.expired</Code>.
              </li>
              <li>
                <strong>Refunds.</strong> Refunds are issued by hand and are not announced. If LumeraMD also cancels the
                membership, you receive <Code>membership.cancelled</Code>.
              </li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
