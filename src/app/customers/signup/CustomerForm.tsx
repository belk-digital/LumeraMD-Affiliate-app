"use client";

import Link from "next/link";
import { useState } from "react";
import Icon from "@/components/Icon";
import PhoneField from "@/components/PhoneField";
import { CUSTOMER_PLANS, PLANS, TEST_KIT_PRICE, type CustomerPlanKey } from "@/lib/membership/plans";

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/35 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelClass = "mb-1.5 block text-sm font-medium text-ink";

// The plan highlighted as the suggested choice.
const POPULAR: CustomerPlanKey = "customer_plus";

export default function CustomerForm({ referralSlug }: { referralSlug?: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [plan, setPlan] = useState<CustomerPlanKey | null>(null);
  const [wantsTestKit, setWantsTestKit] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Plans with a member price on the test kit (Plus and Premium) get the "add a test kit" option.
  const kitPrice = plan ? PLANS[plan].testKitPrice : undefined;

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
      <div className="animate-fade-up py-4">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Icon name="check" className="h-6 w-6" strokeWidth={2.4} />
        </span>
        <h2 className="font-heading text-lg font-semibold text-ink">{PLANS[plan].name} membership requested</h2>
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>First name</label>
          <input
            required
            placeholder="John"
            className={inputClass}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Last name</label>
          <input
            required
            placeholder="Doe"
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
          placeholder="john@example.com"
          className={inputClass}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClass}>
          Phone <span className="font-normal text-ink/50">(optional)</span>
        </label>
        <PhoneField inputClass={inputClass} onChange={(phone) => setForm((f) => ({ ...f, phone }))} />
      </div>

      <fieldset>
        <legend className="mb-3 font-heading text-base font-semibold text-ink">Membership</legend>
        <div className="grid gap-3 pt-2 md:grid-cols-3">
          {CUSTOMER_PLANS.map((p) => {
            const selected = plan === p.key;
            return (
              <label
                key={p.key}
                className={`relative block min-w-0 cursor-pointer rounded-2xl border-2 p-4 transition ${
                  selected ? "border-primary bg-white shadow-md" : "border-line hover:border-primary/40"
                }`}
              >
                {p.key === POPULAR && (
                  <span className="absolute -top-3 left-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">
                    <Icon name="star" className="h-3 w-3" />
                    Most Popular
                  </span>
                )}
                <input
                  type="radio"
                  name="plan"
                  className="sr-only"
                  checked={selected}
                  onChange={() => {
                    setPlan(p.key as CustomerPlanKey);
                    if (p.testKitPrice === undefined) setWantsTestKit(false);
                  }}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="font-heading text-base font-semibold text-ink">{p.name}</span>
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      selected ? "border-primary bg-primary" : "border-line"
                    }`}
                  >
                    {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                </div>
                <div className="mt-1 font-heading text-2xl font-bold text-ink">
                  ${p.monthlyPrice}
                  <span className="text-sm font-normal text-ink/60">/mo</span>
                </div>
                <ul className="mt-3 space-y-2 text-[13px] leading-snug text-ink/70">
                  {p.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                        <Icon name="check" className="h-2.5 w-2.5" strokeWidth={3.5} />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </label>
            );
          })}
        </div>
      </fieldset>

      {kitPrice !== undefined && (
        <label className="flex items-start gap-2.5 rounded-xl bg-primary-light/50 px-4 py-3 text-sm text-ink/80">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-line accent-primary"
            checked={wantsTestKit}
            onChange={(e) => setWantsTestKit(e.target.checked)}
          />
          <span>
            Add a test kit for <strong>${kitPrice}</strong>{" "}
            <span className="text-ink/50 line-through">${TEST_KIT_PRICE}</span>
          </span>
        </label>
      )}

      <p className="flex items-center gap-3 rounded-xl bg-page-bg px-4 py-3.5 text-sm text-ink/70">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white">
          <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        Your monthly fee goes toward your telehealth calls.
      </p>

      {error && <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-base font-medium text-white shadow-md transition hover:bg-primary-dark disabled:opacity-50"
      >
        {submitting ? "Submitting…" : (
          <>
            Continue <Icon name="arrowRight" className="h-5 w-5" />
          </>
        )}
      </button>
    </form>
  );
}
