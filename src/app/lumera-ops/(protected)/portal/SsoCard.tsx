"use client";

import { Check, Copy, LogIn } from "lucide-react";
import { useCopy } from "../signups/_components/kit";

export interface SsoInfo {
  configured: boolean;
  /** Names of the settings still missing (never their values). */
  missing: string[];
  issuer: string;
  discoveryUrl: string;
  clientId: string;
  redirectUris: string[];
  logoutUris: number;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-36 shrink-0 text-sm text-ink/55">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded bg-page-bg px-2 py-1 font-mono text-xs text-ink">{value}</code>
      <button
        onClick={() => copy(value)}
        aria-label={`Copy ${label}`}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-page-bg"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** "Sign in with LumeraMD": the details the portal's team asks for, and what is still missing. */
export default function SsoCard({ sso }: { sso: SsoInfo }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className="rounded-xl bg-primary-light p-2.5 text-primary">
          <LogIn className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-bold text-ink">Single sign-on</h2>
          <p className="text-xs text-ink/55">&ldquo;Sign in with LumeraMD&rdquo; for members, using OpenID Connect.</p>
        </div>
        <span
          className={`ml-auto rounded-full px-2.5 py-1 text-xs font-medium ${
            sso.configured ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {sso.configured ? "On" : "Off"}
        </span>
      </div>

      {sso.configured ? (
        <>
          <div className="divide-y divide-line">
            <CopyRow label="Issuer" value={sso.issuer} />
            <CopyRow label="Discovery address" value={sso.discoveryUrl} />
            <CopyRow label="Client ID" value={sso.clientId} />
          </div>
          <p className="mt-3 text-xs text-ink/55">
            Return address{sso.redirectUris.length === 1 ? "" : "es"} registered: {sso.redirectUris.join(", ")}.{" "}
            {sso.logoutUris > 0
              ? `${sso.logoutUris} sign-out address${sso.logoutUris === 1 ? "" : "es"} registered.`
              : "No sign-out address registered: after signing out, members see a signed-out page here."}
          </p>
          <p className="mt-2 text-xs text-ink/55">
            The client secret was shown once when it was created and can&apos;t be looked up. If it&apos;s lost, run the set-up script again
            and give the portal&apos;s team the new one.
          </p>
        </>
      ) : (
        <div className="space-y-2 text-sm text-ink/70">
          <p>Single sign-on is off. Still missing: {sso.missing.map((m) => m).join(", ")}.</p>
          <p>
            Run <code className="rounded bg-primary-light px-1.5 py-0.5 font-mono text-xs text-primary">pnpm dlx tsx scripts/setupOidc.ts</code>{" "}
            in your own terminal. It prints the settings to add in Vercel (Production, Sensitive) and the client secret to send the
            portal&apos;s team through a one-time link. Then redeploy.
          </p>
        </div>
      )}
    </div>
  );
}
