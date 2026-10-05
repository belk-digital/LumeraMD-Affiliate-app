"use client";

import Link from "next/link";
import { useState } from "react";
import Icon from "@/components/Icon";
import PhoneField from "@/components/PhoneField";
import { PLANS } from "@/lib/membership/plans";

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/35 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelClass = "mb-1.5 block text-sm font-medium text-ink";
const optional = <span className="font-normal text-ink/50">(optional)</span>;
const required = <span className="text-error"> *</span>;

const SALES_TYPES = [
  "Wellness / health products",
  "Medical devices",
  "Pharmaceutical",
  "Insurance",
  "Real estate",
  "Software / SaaS",
  "Direct sales",
  "Other",
];

// Plans offered on this form. Today only Agent; add more here and the picker grows with them.
const PLAN_OPTIONS = [PLANS.agent];

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
  const [plan, setPlan] = useState(PLAN_OPTIONS[0].key);
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
      body.append("plan", plan);
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
      <div className="animate-fade-up py-4">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Icon name="check" className="h-6 w-6" strokeWidth={2.4} />
        </span>
        <h2 className="font-heading text-lg font-semibold text-ink">Thanks, we got it</h2>
        <p className="mt-1 text-sm text-ink/60">Our team will review your details and reach out by email.</p>
        <Link href="/" className="mt-5 inline-block text-sm font-medium text-primary hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Email{required}</label>
          <input
            required
            type="email"
            placeholder="john@example.com"
            className={inputClass}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Resume {optional}</label>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-primary/30 bg-primary-light/30 px-4 py-4 text-center transition hover:bg-primary-light/60">
            <Icon name="upload" className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">{resume ? resume.name : "Upload your resume"}</span>
            <span className="text-xs text-ink/50">PDF or Word, up to 8MB.</span>
            <input
              type="file"
              className="sr-only"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setResume(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div>
          <label className={labelClass}>First name{required}</label>
          <input
            required
            placeholder="John"
            className={inputClass}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Last name{required}</label>
          <input
            required
            placeholder="Doe"
            className={inputClass}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </div>

        <div>
          <label className={labelClass}>Phone{required}</label>
          <PhoneField required inputClass={inputClass} onChange={(phone) => setForm((f) => ({ ...f, phone }))} />
        </div>
        <div>
          <label className={labelClass}>Annual gross sales {optional}</label>
          <div className="flex">
            <span className="flex items-center rounded-l-lg border border-r-0 border-line bg-page-bg px-3 text-sm text-ink/50">$</span>
            <input
              inputMode="decimal"
              placeholder="0"
              className={`${inputClass} rounded-l-none`}
              value={form.annualGrossSales}
              onChange={(e) => setForm({ ...form, annualGrossSales: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass}>Type of sales {optional}</label>
        <select
          className={`${inputClass} ${form.salesType ? "" : "text-ink/40"}`}
          value={form.salesType}
          onChange={(e) => setForm({ ...form, salesType: e.target.value })}
        >
          <option value="">Select type of sales</option>
          {SALES_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="mb-2 font-heading text-base font-semibold text-ink">Plan</legend>
        <div className="space-y-3 pt-2">
          {PLAN_OPTIONS.map((p) => {
            const selected = plan === p.key;
            const savings = p.listPrice ? p.listPrice - p.monthlyPrice : 0;
            return (
              <label
                key={p.key}
                className={`relative block cursor-pointer rounded-2xl border-2 p-5 transition ${
                  selected ? "border-primary bg-white" : "border-line hover:border-primary/40"
                }`}
              >
                {savings > 0 && (
                  <span className="absolute -top-3 left-5 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">
                    <Icon name="star" className="h-3 w-3" />
                    Save ${savings}
                  </span>
                )}
                <input type="radio" name="plan" className="sr-only" checked={selected} onChange={() => setPlan(p.key)} />
                <span
                  aria-hidden
                  className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                    selected ? "border-primary bg-primary" : "border-line"
                  }`}
                >
                  {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:gap-8">
                  <div className="sm:pr-8 sm:border-r sm:border-line">
                    <div className="font-heading text-xl font-semibold text-ink">{p.name}</div>
                    <div className="mt-2 flex items-baseline gap-2">
                      {p.listPrice && (
                        <span className="text-base text-ink/40 line-through" aria-label={`Regular price $${p.listPrice}`}>
                          ${p.listPrice}
                        </span>
                      )}
                      <span className="font-heading text-3xl font-bold text-ink">
                        ${p.monthlyPrice}
                        <span className="text-base font-normal text-ink/60">/mo</span>
                      </span>
                    </div>
                  </div>
                  <ul className="grid content-center gap-2 text-sm text-ink/70 sm:pr-8">
                    {p.benefits.map((b) => (
                      <li key={b} className="flex items-center gap-2.5">
                        <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                          <Icon name="check" className="h-3 w-3" strokeWidth={3} />
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      {error && <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-base font-medium text-white shadow-md transition hover:bg-primary-dark disabled:opacity-50"
      >
        {submitting ? "Submitting…" : (
          <>
            Sign up <Icon name="arrowRight" className="h-5 w-5" />
          </>
        )}
      </button>

      <p className="text-center text-sm text-ink/55">
        Already an affiliate?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
