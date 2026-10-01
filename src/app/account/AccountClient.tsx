"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="rounded-lg bg-primary-light px-3 py-2 font-mono text-sm font-semibold text-primary">
        {code}
      </code>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable — the code is selectable on screen */
          }
        }}
        className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink/70 transition hover:bg-page-bg"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        await fetch("/api/customers/auth/logout", { method: "POST" });
        router.push("/account/login");
        router.refresh();
      }}
      disabled={busy}
      className="rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-ink/70 transition hover:bg-page-bg disabled:opacity-50"
    >
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
