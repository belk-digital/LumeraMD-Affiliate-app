"use client";

import Link from "next/link";
import { useState } from "react";

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/35 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelClass = "mb-1.5 block text-sm font-medium text-ink/80";
const optional = <span className="font-normal text-ink/40">(optional)</span>;

export default function SalesRepForm({ referralSlug }: { referralSlug?: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    annualGrossSales: "",
    salesType: "",
  });
  const [resume, setResume] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const body = new FormData();
      for (const [key, value] of Object.entries(form)) body.append(key, value);
      if (referralSlug) body.append("referralSlug", referralSlug);
      if (resume) body.append("resume", resume);

      const res = await fetch("/api/sales-reps/signup", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
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
        <h2 className="font-heading text-lg font-semibold text-ink">Thanks, we got it</h2>
        <p className="mt-1 text-sm text-ink/60">
          Our team will review your details and reach out by email.
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
        <label className={labelClass}>Resume {optional}</label>
        <p className="mb-2 text-xs text-ink/50">
          PDF or Word, up to 8MB. You can attach it instead of filling in the rest.
        </p>
        <input
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => setResume(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-light file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary-light/80"
        />
        {resume && (
          <p className="mt-1.5 text-xs text-ink/60">
            Attached: <span className="font-medium text-ink">{resume.name}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>First name {optional}</label>
          <input
            className={inputClass}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Last name {optional}</label>
          <input
            className={inputClass}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Phone {optional}</label>
        <input
          type="tel"
          className={inputClass}
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClass}>Annual gross sales {optional}</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink/40">
            $
          </span>
          <input
            inputMode="decimal"
            placeholder="250,000"
            className={`${inputClass} pl-7`}
            value={form.annualGrossSales}
            onChange={(e) => setForm({ ...form, annualGrossSales: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Type of sales {optional}</label>
        <input
          placeholder="e.g. wellness products, medical devices, insurance"
          className={inputClass}
          value={form.salesType}
          onChange={(e) => setForm({ ...form, salesType: e.target.value })}
        />
      </div>

      {error && <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Sign up"}
      </button>

      <p className="text-center text-sm text-ink/50">
        Already a rep?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
