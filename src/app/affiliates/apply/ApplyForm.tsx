"use client";

import Link from "next/link";
import { useState } from "react";

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/35 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelClass = "mb-1.5 block text-sm font-medium text-ink/80";

export default function ApplyForm({ referralSlug }: { referralSlug?: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    websiteUrl: "",
    promotionMethods: "",
    agreedToTerms: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/affiliates/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, referralSlug }),
    });

    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="animate-fade-up rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-7">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <h2 className="font-heading text-lg font-semibold text-ink">Application received</h2>
        <p className="mt-1 text-sm text-ink/60">
          Thanks! We&apos;ll review your application and email you once it&apos;s approved.
        </p>
        <Link href="/" className="mt-5 inline-block text-sm font-medium text-primary hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-7"
    >
      <div>
        <label className={labelClass}>Name</label>
        <input
          required
          className={inputClass}
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClass}>Email</label>
        <input
          required
          type="email"
          className={inputClass}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClass}>
          Website / social profile <span className="font-normal text-ink/40">(optional)</span>
        </label>
        <input
          className={inputClass}
          value={form.websiteUrl}
          onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClass}>How will you promote us?</label>
        <textarea
          rows={3}
          className={inputClass}
          value={form.promotionMethods}
          onChange={(e) => setForm({ ...form, promotionMethods: e.target.value })}
        />
      </div>

      <label className="flex items-start gap-2.5 text-sm text-ink/70">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-line accent-primary"
          checked={form.agreedToTerms}
          onChange={(e) => setForm({ ...form, agreedToTerms: e.target.checked })}
        />
        I agree to the affiliate program terms
      </label>

      {error && (
        <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Apply now"}
      </button>

      <p className="text-center text-sm text-ink/50">
        Already approved?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
