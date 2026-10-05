"use client";

import { useState } from "react";
import { Lock, Mail } from "lucide-react";

export default function SystemStatus({
  emailLive,
  ccAddress,
  admins,
}: {
  /** True when an email provider key is configured, so mail reaches real recipients. */
  emailLive: boolean;
  ccAddress: string;
  admins: string[];
}) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function sendTest() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/lumera-ops/settings/test-email", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? "Could not send the test email." });
        return;
      }
      setResult({
        ok: true,
        message:
          data.result === "logged"
            ? "No email provider is set up here, so the message was only written to the server log."
            : `Sent to ${data.to}. Check your inbox.`,
      });
    } catch {
      setResult({ ok: false, message: "Could not reach the server." });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-heading text-xl font-semibold text-ink">System status</h2>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-line p-4">
          <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
              <Mail className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1 basis-40">
              <div className="font-heading text-base font-semibold text-ink">Email delivery</div>
              <div className="mt-1 flex items-start gap-2 text-sm text-ink/70">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${emailLive ? "bg-emerald-500" : "bg-amber-500"}`}
                  aria-hidden
                />
                <span>
                  {emailLive ? (
                    <>
                      <span className="font-medium text-emerald-700">Live</span> — email goes to real
                      recipients (CC {ccAddress})
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-amber-700">Off</span> — emails are only written to
                      the server log
                    </>
                  )}
                </span>
              </div>
            </div>
            <button
              onClick={sendTest}
              disabled={sending}
              className="shrink-0 rounded-lg border border-primary/40 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary-light disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send test email"}
            </button>
          </div>
          {result && (
            <p
              className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                result.ok ? "bg-emerald-50 text-emerald-700" : "bg-error/10 text-error"
              }`}
              role="status"
            >
              {result.message}
            </p>
          )}
        </div>

        <div className="min-w-0 rounded-xl border border-line p-4">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
              <Lock className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-heading text-base font-semibold text-ink">Admin access</div>
              <div className="mt-1 break-words text-sm text-ink/70">{admins.join(", ") || "—"}</div>
              <p className="mt-2 text-xs text-ink/45">
                Admins are set in the ADMIN_ALLOWED_EMAILS setting on the server.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
