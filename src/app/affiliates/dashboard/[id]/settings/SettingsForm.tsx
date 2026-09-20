"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Values {
  displayName: string;
  payoutMethod: string;
  payoutDestination: string;
  emailNotifications: boolean;
  referralSlug: string;
  shopifyDiscountCode: string;
}

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelClass = "block text-sm font-medium text-ink/80 mb-1.5";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 space-y-4">
      <div>
        <h2 className="font-heading text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-ink/50">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default function SettingsForm({
  email,
  initial,
}: {
  email: string;
  initial: Values;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setStatus("idle");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);

    const res = await fetch("/api/affiliates/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus("error");
      setError(
        res.status === 401
          ? "Only the affiliate can change these settings while logged in."
          : (data.error ?? "Something went wrong"),
      );
      return;
    }

    setStatus("saved");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Section title="Profile">
        <div>
          <label className={labelClass}>Display name</label>
          <input
            className={inputClass}
            maxLength={80}
            value={values.displayName}
            onChange={(e) => update("displayName", e.target.value)}
            placeholder="How your name appears in the dashboard"
          />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input className={`${inputClass} bg-page-bg text-ink/60`} value={email} disabled />
          <p className="mt-1 text-xs text-ink/40">
            Your login email. Contact us if you need it changed.
          </p>
        </div>
      </Section>

      <Section
        title="Payout details"
        description="Saved here and pre-filled whenever you request a payout."
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Method</label>
            <select
              className={inputClass}
              value={values.payoutMethod}
              onChange={(e) => update("payoutMethod", e.target.value)}
            >
              <option value="">Not set</option>
              <option value="zelle">Zelle</option>
              <option value="cashapp">Cash App</option>
              <option value="paypal">PayPal</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Email / $cashtag</label>
            <input
              className={inputClass}
              maxLength={200}
              value={values.payoutDestination}
              onChange={(e) => update("payoutDestination", e.target.value)}
            />
          </div>
        </div>
      </Section>

      <Section title="Notifications">
        <label className="flex items-start gap-3 text-sm text-ink/70">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-line accent-primary"
            checked={values.emailNotifications}
            onChange={(e) => update("emailNotifications", e.target.checked)}
          />
          <span>
            Email me about commissions and team activity
            <span className="block text-xs text-ink/40">
              In-app notifications (the bell) are always on.
            </span>
          </span>
        </label>
      </Section>

      <Section title="Your referral identity">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Referral slug</label>
            <input
              className={inputClass}
              maxLength={100}
              value={values.referralSlug}
              onChange={(e) => update("referralSlug", e.target.value)}
            />
            <p className="mt-1 text-xs text-ink/40">
              Only letters, numbers, and dashes.
            </p>
          </div>
          <div>
            <label className={labelClass}>Discount code</label>
            <input
              className={inputClass}
              maxLength={100}
              value={values.shopifyDiscountCode}
              onChange={(e) => update("shopifyDiscountCode", e.target.value)}
              placeholder="Leave blank for none"
            />
          </div>
        </div>
      </Section>

      {error && (
        <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        {status === "saved" && <span className="text-sm text-ink/50">Saved.</span>}
      </div>
    </form>
  );
}
