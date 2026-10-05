"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const input =
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-page-bg disabled:text-ink/50";

export default function ProfileForm(p: { firstName: string; lastName: string; phone: string; email: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(p.firstName);
  const [lastName, setLastName] = useState(p.lastName);
  const [phone, setPhone] = useState(p.phone);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/customers/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Could not save your changes." });
        return;
      }
      setMessage({ ok: true, text: "Saved." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-ink/70">
          First name
          <input className={`${input} mt-1`} value={firstName} onChange={(e) => setFirstName(e.target.value)} required maxLength={80} />
        </label>
        <label className="block text-sm text-ink/70">
          Last name
          <input className={`${input} mt-1`} value={lastName} onChange={(e) => setLastName(e.target.value)} required maxLength={80} />
        </label>
        <label className="block text-sm text-ink/70">
          Email
          <input className={`${input} mt-1`} value={p.email} disabled readOnly />
        </label>
        <label className="block text-sm text-ink/70">
          Phone
          <input className={`${input} mt-1`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
        </label>
      </div>
      <p className="text-xs text-ink/45">Your email is how you sign in, so it can&apos;t be changed here. Contact us if you need to change it.</p>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        {message && <span className={`text-sm ${message.ok ? "text-emerald-700" : "text-error"}`}>{message.text}</span>}
      </div>
    </form>
  );
}
