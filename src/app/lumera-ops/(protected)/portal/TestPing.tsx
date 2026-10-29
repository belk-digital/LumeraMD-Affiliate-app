"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Notice } from "../signups/_components/kit";

/** Sends the portal a signed test message, so their team can check their set-up before a real event. */
export default function TestPing() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/lumera-ops/portal/test", { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    setResult(
      data?.ok
        ? { ok: true, text: `The portal accepted it (HTTP ${data.status}, ${data.ms} ms).` }
        : { ok: false, text: data?.error ?? "Couldn't send the test. Try again." },
    );
  }

  return (
    <div className="mt-4 space-y-2 border-t border-line pt-4">
      <button
        onClick={run}
        disabled={busy}
        className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink/80 transition hover:bg-page-bg disabled:opacity-50"
      >
        <Send className="h-4 w-4 text-ink/60" />
        {busy ? "Sending…" : "Send test notification"}
      </button>
      {result && <Notice tone={result.ok ? "good" : "warn"}>{result.text}</Notice>}
      <p className="text-xs text-ink/50">
        A signed message with no member data, so the portal&apos;s team can check their address and signature code.
      </p>
    </div>
  );
}
