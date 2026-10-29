"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpen, Check, Copy, KeyRound, Plus, Search, Webhook } from "lucide-react";
import { Backdrop, Notice, inputClass, useCopy } from "../signups/_components/kit";
import Deliveries, { type EventRow } from "./Deliveries";
import TestPing from "./TestPing";

export interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  createdBy: string | null;
  created: string;
  lastUsed: string | null;
  /** Date it was revoked, or null while it still works. */
  revoked: string | null;
}

export interface WebhookInfo {
  configured: boolean;
  host: string | null;
  delivered: number;
  retrying: number;
  failed: number;
}

const card = "rounded-2xl border border-line bg-white p-5 shadow-sm";

function StatusCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className={`${card} min-w-0`}>
      <div className="mb-3 flex items-center gap-3">
        <div className="rounded-xl bg-primary-light p-2.5 text-primary">{icon}</div>
        <span className="text-sm font-semibold text-ink/70">{label}</span>
      </div>
      {children}
    </div>
  );
}

function Dot({ on }: { on: boolean }) {
  return <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${on ? "bg-emerald-500" : "bg-slate-300"}`} />;
}

export default function PortalClient({
  keys,
  events,
  eventTotal,
  eventQuery,
  pageSize,
  webhook,
  docsUrl,
  baseUrl,
}: {
  keys: KeyRow[];
  events: EventRow[];
  eventTotal: number;
  eventQuery: { status: string; page: number };
  pageSize: number;
  webhook: WebhookInfo;
  docsUrl: string;
  baseUrl: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{ name: string; key: string } | null>(null);
  const [revoking, setRevoking] = useState<KeyRow | null>(null);

  const active = keys.filter((k) => !k.revoked);
  const lastUsed = active.find((k) => k.lastUsed)?.lastUsed ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-ink">API &amp; webhooks</h1>
          <p className="mt-1 text-sm text-ink/60">
            Lets the customer portal check a member&apos;s status and hear when it changes, so paid members get their discount at checkout.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-page-bg"
          >
            <BookOpen className="h-4 w-4 text-ink/60" />
            Documentation
          </a>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            Create API key
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard icon={<KeyRound className="h-5 w-5" />} label="Member API">
          <div className="font-heading text-xl font-bold text-ink">
            <Dot on={active.length > 0} />
            {active.length > 0 ? "On" : "Off"}
          </div>
          <p className="mt-1 text-xs text-ink/55">
            {active.length > 0
              ? `${active.length} active key${active.length === 1 ? "" : "s"}${lastUsed ? ` · last used ${lastUsed}` : " · not used yet"}`
              : "Create a key to switch it on."}
          </p>
        </StatusCard>
        <StatusCard icon={<Webhook className="h-5 w-5" />} label="Webhooks">
          <div className="font-heading text-xl font-bold text-ink">
            <Dot on={webhook.configured} />
            {webhook.configured ? "On" : "Off"}
          </div>
          <p className="mt-1 truncate text-xs text-ink/55">
            {webhook.configured ? `Sending to ${webhook.host ?? "the configured address"}` : "No address configured yet."}
          </p>
        </StatusCard>
        <StatusCard icon={<Check className="h-5 w-5" />} label="Notifications, last 24 hours">
          <div className="font-heading text-xl font-bold text-ink">{webhook.delivered.toLocaleString("en-US")} delivered</div>
          <p className="mt-1 text-xs text-ink/55">
            {webhook.retrying} retrying · {webhook.failed} failed
            {webhook.failed > 0 ? " — check the portal's address" : ""}
          </p>
        </StatusCard>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-heading text-lg font-bold text-ink">API keys</h2>
          <p className="mt-0.5 text-xs text-ink/55">
            A key is shown once, when you create it. Only a fingerprint is kept, so a lost key can&apos;t be recovered: create a new one and
            revoke the old one.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="border-b border-line bg-page-bg/50 text-xs font-semibold text-ink/60">
              <tr>
                <th className="px-5 py-3.5">Name</th>
                <th className="px-4 py-3.5">Key</th>
                <th className="px-4 py-3.5">Created</th>
                <th className="px-4 py-3.5">Last used</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {keys.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center font-medium text-ink/50">
                    No keys yet. Create one to give the portal access.
                  </td>
                </tr>
              )}
              {keys.map((k) => (
                <tr key={k.id} className={k.revoked ? "text-ink/45" : ""}>
                  <td className="px-5 py-3.5 font-semibold">{k.name}</td>
                  <td className="px-4 py-3.5 font-mono text-xs">{k.prefix}…</td>
                  <td className="px-4 py-3.5">
                    {k.created}
                    {k.createdBy && <div className="text-xs text-ink/45">by {k.createdBy}</div>}
                  </td>
                  <td className="px-4 py-3.5">{k.lastUsed ?? "Never"}</td>
                  <td className="px-4 py-3.5">
                    {k.revoked ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">Revoked {k.revoked}</span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {!k.revoked && (
                      <button
                        onClick={() => setRevoking(k)}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-error transition hover:bg-error/10"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Deliveries events={events} total={eventTotal} query={eventQuery} pageSize={pageSize} configured={webhook.configured} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Lookup />
        <div className={card}>
          <h2 className="font-heading text-lg font-bold text-ink">Webhook set-up</h2>
          {webhook.configured ? (
            <p className="mt-2 text-sm text-ink/70">
              Notifications are being sent to <strong>{webhook.host}</strong>, signed with the secret you configured. To change the
              address or the secret, update the two variables below in Vercel and redeploy.
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink/70">
              Webhooks are off. Once the portal&apos;s team gives you the HTTPS address to send to, add these two variables in Vercel
              (Production) and redeploy:
            </p>
          )}
          <ul className="mt-3 space-y-2 text-sm text-ink/75">
            <li>
              <code className="rounded bg-primary-light px-1.5 py-0.5 font-mono text-xs text-primary">PORTAL_WEBHOOK_URL</code> the
              address they give you
            </li>
            <li>
              <code className="rounded bg-primary-light px-1.5 py-0.5 font-mono text-xs text-primary">PORTAL_WEBHOOK_SECRET</code> a
              long random string. Generate one with <code className="font-mono text-xs">openssl rand -hex 32</code>, then give the
              same value to the portal&apos;s team so they can verify our signature.
            </li>
          </ul>
          {webhook.configured && <TestPing />}
          <p className="mt-3 text-xs text-ink/50">API base address: {baseUrl}</p>
        </div>
      </div>

      {creating && (
        <CreateKeyModal
          onClose={() => setCreating(false)}
          onCreated={(created) => {
            setCreating(false);
            setNewKey(created);
          }}
        />
      )}
      {newKey && (
        <RevealModal
          created={newKey}
          onClose={() => {
            setNewKey(null);
            router.refresh();
          }}
        />
      )}
      {revoking && (
        <RevokeModal
          target={revoking}
          onClose={() => setRevoking(null)}
          onDone={() => {
            setRevoking(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function CreateKeyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: { name: string; key: string }) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/lumera-ops/portal/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? "Couldn't create the key. Try again.");
    onCreated({ name: data.record.name, key: data.key });
  }

  return (
    <Backdrop onClose={onClose}>
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="font-heading text-xl font-bold text-ink">Create API key</h2>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink/80">Name</label>
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Customer portal (Group ISO)"
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-ink/50">Who or what this key is for, so you can tell keys apart later.</p>
        </div>
        {error && <Notice tone="bad">{error}</Notice>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink/60 transition hover:text-ink">
            Cancel
          </button>
          <button
            disabled={busy || name.trim().length < 2}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create key"}
          </button>
        </div>
      </form>
    </Backdrop>
  );
}

function RevealModal({ created, onClose }: { created: { name: string; key: string }; onClose: () => void }) {
  const { copied, copy } = useCopy();
  const [confirmed, setConfirmed] = useState(false);

  // No click-outside close here: the key can't be shown again, so closing has to be deliberate.
  return (
    <Backdrop onClose={() => {}}>
      <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="font-heading text-xl font-bold text-ink">Your new API key</h2>
        <Notice tone="warn">Copy it now. This is the only time it is shown, and it can&apos;t be recovered afterwards.</Notice>
        <div>
          <div className="mb-1.5 text-sm font-medium text-ink/80">{created.name}</div>
          <div className="flex items-stretch gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg border border-line bg-page-bg px-3 py-2.5 font-mono text-xs text-ink">
              {created.key}
            </code>
            <button
              onClick={() => copy(created.key)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-ink/80 transition hover:bg-page-bg"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <p className="text-sm text-ink/60">
          Send it to the portal&apos;s team over a private channel, and ask them to keep it on their server only.
        </p>
        <label className="flex items-center gap-2 text-sm text-ink/80">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="rounded border-line text-primary focus:ring-primary/20"
          />
          I&apos;ve copied the key somewhere safe
        </label>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            disabled={!confirmed}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

function RevokeModal({ target, onClose, onDone }: { target: KeyRow; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function revoke() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/lumera-ops/portal/keys/${target.id}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError("Couldn't revoke the key. Try again.");
    onDone();
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="font-heading text-xl font-bold text-ink">Revoke “{target.name}”?</h2>
        <p className="text-sm text-ink/70">
          Anything using this key stops working immediately, and the key can&apos;t be turned back on. If the portal still needs access,
          create a new key first and give it to them.
        </p>
        {error && <Notice tone="bad">{error}</Notice>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink/60 transition hover:text-ink">
            Keep it
          </button>
          <button
            onClick={revoke}
            disabled={busy}
            className="rounded-lg bg-error px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Revoking…" : "Revoke key"}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

/** Shows exactly what the portal would get back for an email, so a lookup can be checked without a key. */
function Lookup() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/lumera-ops/portal/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    setResult(
      res?.ok
        ? { ok: true, text: JSON.stringify(data.member, null, 2) }
        : { ok: false, text: data?.error ?? "Couldn't look that up. Try again." },
    );
  }

  return (
    <div className={card}>
      <h2 className="font-heading text-lg font-bold text-ink">Try a lookup</h2>
      <p className="mt-1 text-sm text-ink/60">See exactly what the portal would receive for a member.</p>
      <form onSubmit={run} className="mt-3 flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="member@example.com"
          aria-label="Member email"
          className={inputClass}
        />
        <button
          disabled={busy}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          {busy ? "…" : "Look up"}
        </button>
      </form>
      {result &&
        (result.ok ? (
          <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-[#0f1b2a] p-4 text-xs leading-relaxed text-slate-100">{result.text}</pre>
        ) : (
          <div className="mt-3">
            <Notice tone="warn">{result.text}</Notice>
          </div>
        ))}
    </div>
  );
}
