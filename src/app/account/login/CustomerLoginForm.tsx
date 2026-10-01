"use client";

import Link from "next/link";
import { useState } from "react";
import Icon from "@/components/Icon";

export default function CustomerLoginForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/customers/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Too many requests. Please try again shortly.");
        return;
      }
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="animate-fade-up rounded-2xl border border-line bg-white p-6 shadow-sm">
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
          <Icon name="document" className="h-5 w-5" />
        </span>
        <p className="font-heading font-semibold text-ink">Check your inbox</p>
        <p className="mt-1 text-sm text-ink/60">
          If <span className="font-medium text-ink">{email}</span> has a LumeraMD membership,
          we&apos;ve sent a login link. It expires in 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-sm"
    >
      {initialError && !error && (
        <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          That login link is invalid or has expired. Request a new one below.
        </p>
      )}
      {error && <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink/80">Email</label>
        <input
          required
          type="email"
          placeholder="you@example.com"
          className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Email me a login link"}
      </button>
      <p className="text-center text-sm text-ink/50">
        Not a member yet?{" "}
        <Link href="/customers/signup" className="font-medium text-primary hover:underline">
          Choose a plan
        </Link>
      </p>
    </form>
  );
}
