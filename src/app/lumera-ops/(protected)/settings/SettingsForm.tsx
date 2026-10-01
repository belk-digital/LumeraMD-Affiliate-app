"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Values {
  defaultCommissionRate: number;
  defaultCommissionType: string;
  defaultCommissionOn: string;
  defaultCookieDurationDays: number;
  defaultPendingPeriodDays: number;
  defaultMinimumPayoutThreshold: number;
  defaultParentOverrideRate: number;
  unilevelEnabled: boolean;
  membershipCommissionEnabled: boolean;
  unilevelMinPersonalSales: number;
  unilevelRequiredRecruits: number;
  unilevelActiveRecruitMinSales: number;
  unilevelSlotRates: number[];
  unilevelSellerTiers: { name: string; minMonthlySales: number; rate: number }[];
}

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelClass = "mb-1.5 block text-sm font-medium text-ink/80";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink/40">{hint}</p>}
    </div>
  );
}

export default function SettingsForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [v, setV] = useState<Values>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setV((prev) => ({ ...prev, [key]: value }));
    setStatus("idle");
  }

  function setTier(i: number, patch: Partial<Values["unilevelSellerTiers"][number]>) {
    set(
      "unilevelSellerTiers",
      v.unilevelSellerTiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)),
    );
  }
  function setSlot(i: number, value: number) {
    set(
      "unilevelSlotRates",
      v.unilevelSlotRates.map((r, idx) => (idx === i ? value : r)),
    );
  }

  const num = (e: React.ChangeEvent<HTMLInputElement>) =>
    e.target.value === "" ? 0 : Number(e.target.value);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);

    const res = await fetch("/api/lumera-ops/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus("error");
      setError(data.error ?? "Something went wrong");
      return;
    }
    setStatus("saved");
    router.refresh();
  }

  const percent = v.defaultCommissionType === "percent";

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="space-y-5 rounded-2xl border border-line bg-white p-5 shadow-sm">
        <div>
          <h2 className="font-heading text-base font-semibold text-ink">Program defaults</h2>
          <p className="mt-0.5 text-xs text-ink/50">
            Applied to affiliates approved from now on. Existing affiliates keep the terms they
            were approved with.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Commission type">
            <select
              className={inputClass}
              value={v.defaultCommissionType}
              onChange={(e) => set("defaultCommissionType", e.target.value)}
            >
              <option value="percent">Percentage of order</option>
              <option value="fixed">Fixed amount per order</option>
            </select>
          </Field>
          <Field label={percent ? "Commission rate (%)" : "Commission per order ($)"}>
            <input
              type="number"
              step="0.01"
              min={0}
              className={inputClass}
              value={v.defaultCommissionRate}
              onChange={(e) => set("defaultCommissionRate", num(e))}
            />
          </Field>
          <Field
            label="Commission is calculated on"
            hint="After-coupon means affiliates aren't paid on money the store discounted away."
          >
            <select
              className={inputClass}
              value={v.defaultCommissionOn}
              onChange={(e) => set("defaultCommissionOn", e.target.value)}
            >
              <option value="subtotal_after_coupon">Subtotal after discount</option>
              <option value="subtotal_before_coupon">Subtotal before discount</option>
            </select>
          </Field>
          <Field label="Team override (%)" hint="Paid to the affiliate who recruited the seller.">
            <input
              type="number"
              step="0.01"
              min={0}
              max={100}
              className={inputClass}
              value={v.defaultParentOverrideRate}
              onChange={(e) => set("defaultParentOverrideRate", num(e))}
            />
          </Field>
          <Field label="Referral cookie (days)" hint="How long a click stays attributable.">
            <input
              type="number"
              min={1}
              max={365}
              className={inputClass}
              value={v.defaultCookieDurationDays}
              onChange={(e) => set("defaultCookieDurationDays", num(e))}
            />
          </Field>
          <Field
            label="Pending period (days)"
            hint="Commissions wait this long before becoming payable."
          >
            <input
              type="number"
              min={0}
              max={365}
              className={inputClass}
              value={v.defaultPendingPeriodDays}
              onChange={(e) => set("defaultPendingPeriodDays", num(e))}
            />
          </Field>
          <Field label="Minimum payout ($)">
            <input
              type="number"
              step="0.01"
              min={0}
              className={inputClass}
              value={v.defaultMinimumPayoutThreshold}
              onChange={(e) => set("defaultMinimumPayoutThreshold", num(e))}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-5 rounded-2xl border border-line bg-white p-5 shadow-sm">
        <div>
          <h2 className="font-heading text-base font-semibold text-ink">Unilevel compensation plan</h2>
          <p className="mt-0.5 text-xs text-ink/50">
            Sellers earn a tiered rate on their monthly sales, and up to five qualified uplines earn
            overrides. When off, the flat commission and single team override above apply.
          </p>
        </div>

        <label className="flex items-start gap-2.5 text-sm text-ink/80">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-line accent-primary"
            checked={v.unilevelEnabled}
            onChange={(e) => set("unilevelEnabled", e.target.checked)}
          />
          <span>
            Use the unilevel plan for new orders
            <span className="block text-xs text-ink/40">
              Only affects orders placed after you save. Existing commissions are not recalculated.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2.5 text-sm text-ink/80">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-line accent-primary"
            checked={v.membershipCommissionEnabled}
            onChange={(e) => set("membershipCommissionEnabled", e.target.checked)}
          />
          <span>
            Pay reps commission on membership payments
            <span className="block text-xs text-ink/40">
              When a customer a rep referred pays their monthly membership, the rep earns commission
              on it like a product sale (and uplines earn overrides if the unilevel plan is on).
              Off until the client confirms membership fees count as sales.
            </span>
          </span>
        </label>

        <div>
          <h3 className="mb-2 text-sm font-medium text-ink/80">Seller tiers (by monthly personal sales)</h3>
          <div className="space-y-2">
            {v.unilevelSellerTiers.map((t, i) => (
              <div key={t.name} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-3">
                <span className="text-sm text-ink/70">{t.name}</span>
                <input
                  type="number"
                  min={0}
                  disabled={i === 0}
                  aria-label={`${t.name} minimum monthly sales`}
                  className={inputClass}
                  value={t.minMonthlySales}
                  onChange={(e) => setTier(i, { minMonthlySales: num(e) })}
                />
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  aria-label={`${t.name} rate percent`}
                  className={inputClass}
                  value={t.rate}
                  onChange={(e) => setTier(i, { rate: num(e) })}
                />
              </div>
            ))}
            <p className="text-xs text-ink/40">Columns: tier, minimum monthly sales ($), seller rate (%).</p>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-ink/80">Override rates by paid slot (%)</h3>
          <div className="grid grid-cols-5 gap-3">
            {v.unilevelSlotRates.map((r, i) => (
              <div key={i}>
                <label className="mb-1 block text-xs text-ink/50">Slot {i + 1}</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  className={inputClass}
                  value={r}
                  onChange={(e) => setSlot(i, num(e))}
                />
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink/40">
            Slot 1 goes to the first qualified upline, slot 2 to the next, and so on. Unqualified
            uplines are skipped. Unfilled slots stay with the company.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Recruits required" hint="Active recruits an upline needs to qualify.">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={v.unilevelRequiredRecruits}
              onChange={(e) => set("unilevelRequiredRecruits", num(e))}
            />
          </Field>
          <Field label="Personal sales required ($/mo)" hint="An upline's own monthly sales to qualify. 0 = none.">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={v.unilevelMinPersonalSales}
              onChange={(e) => set("unilevelMinPersonalSales", num(e))}
            />
          </Field>
          <Field label="Recruit is active at ($/mo)" hint="Monthly sales for a recruit to count. 0 = any approved recruit.">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={v.unilevelActiveRecruitMinSales}
              onChange={(e) => set("unilevelActiveRecruitMinSales", num(e))}
            />
          </Field>
        </div>
      </section>

      {error && (
        <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save defaults"}
        </button>
        {status === "saved" && <span className="text-sm text-ink/50">Saved.</span>}
      </div>
    </form>
  );
}
