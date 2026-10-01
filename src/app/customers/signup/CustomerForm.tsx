"use client";

import Link from "next/link";
import { useState } from "react";
import { CUSTOMER_PLANS, PLANS, TEST_KIT_PRICE, type CustomerPlanKey } from "@/lib/membership/plans";

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/35 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelClass = "mb-1.5 block text-sm font-medium text-ink/80";

export default function CustomerForm({ referralSlug }: { referralSlug?: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [plan, setPlan] = useState<CustomerPlanKey | null>(null);
  const [wantsTestKit, setWantsTestKit] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!plan) {
      setError("Please choose a membership plan.");
      return;
    }
    setSubmitting(true);

    try {
      const res = await fetch("/api/customers/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, plan, wantsTestKit, referralSlug }),
      });
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

  if (submitted && plan) {
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
        <h2 className="font-heading text-lg font-semibold text-ink">
          {PLANS[plan].name} membership requested
        </h2>
        <p className="mt-1 text-sm text-ink/60">
          We&apos;ve got your details. We&apos;ll email you the next steps to start your membership.
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>First name</label>
          <input
            required
            className={inputClass}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Last name</label>
          <input
            required
            className={inputClass}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </div>
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
          Phone <span className="font-normal text-ink/40">(optional)</span>
        </label>
        <input
          type="tel"
          className={inputClass}
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </div>

      <fieldset>
        <legend className={labelClass}>Membership</legend>
        <div className="space-y-2.5">
          {CUSTOMER_PLANS.map((p) => {
            const selected = plan === p.key;
            return (
              <label
                key={p.key}
                className={`block cursor-pointer rounded-xl border p-4 transition ${
                  selected
                    ? "border-primary bg-primary-light/50 ring-2 ring-primary/15"
                    : "border-line hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="plan"
                    className="h-4 w-4 accent-primary"
                    checked={selected}
                    onChange={() => {
                      setPlan(p.key as CustomerPlanKey);
                      if (p.key !== "customer_premium") setWantsTestKit(false);
                    }}
                  />
                  <span className="flex-1 font-medium text-ink">{p.name}</span>
                  <span className="text-sm font-semibold text-ink">
                    ${p.monthlyPrice}
                    <span className="font-normal text-ink/50">/mo</span>
                  </span>
                </div>
                <ul className="ml-7 mt-2 space-y-0.5 text-xs text-ink/60">
                  {p.benefits.map((b) => (
                    <li key={b}>• {b}</li>
                  ))}
                </ul>
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink/50">
          Your monthly fee goes toward your telehealth calls.
        </p>
      </fieldset>

      {plan === "customer_premium" && (
        <label className="flex items-start gap-2.5 rounded-xl bg-primary-light/50 px-4 py-3 text-sm text-ink/80">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-line accent-primary"
            checked={wantsTestKit}
            onChange={(e) => setWantsTestKit(e.target.checked)}
          />
          <span>
            Add a test kit for <strong>${PLANS.customer_premium.testKitPrice}</strong>{" "}
            <span className="text-ink/50 line-through">${TEST_KIT_PRICE}</span>
          </span>
        </label>
      )}

      {error && <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Continue"}
      </button>
    </form>
  );
}
