"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleDollarSign, Percent, Save, ShoppingCart } from "lucide-react";

interface Values {
  defaultCommissionRate: number;
  defaultCommissionType: string;
  defaultCommissionOn: string;
  defaultCookieDurationDays: number;
  defaultPendingPeriodDays: number;
  defaultMinimumPayoutThreshold: number;
  defaultParentOverrideRate: number;
  defaultCanRecruit: boolean;
  walletEnabled: boolean;
  walletOrderEarnPercent: number;
  walletOrderMinSubtotal: number;
  walletMembershipEarnPercent: number;
  walletMinRedeem: number;
  walletRedeemExpiryDays: number;
  unilevelEnabled: boolean;
  membershipCommissionEnabled: boolean;
  unilevelMinPersonalSales: number;
  unilevelRequiredRecruits: number;
  unilevelActiveRecruitMinSales: number;
  unilevelSlotRates: number[];
  unilevelSellerTiers: { name: string; minMonthlySales: number; rate: number }[];
}

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-page-bg disabled:text-ink/40";
const compactInputClass = inputClass.replace("py-2.5", "py-1.5");
const labelClass = "mb-1.5 block text-sm font-medium text-ink";
const cardClass = "rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6";

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
      <div className={labelClass}>{label}</div>
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink/45">{hint}</p>}
    </div>
  );
}

/** A number box with a unit (%, $, days) in a tinted cell on the right. */
function SuffixInput({
  suffix,
  compact = false,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { suffix: string; compact?: boolean }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-line bg-white transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
      <input
        type="number"
        {...props}
        className={`min-w-0 flex-1 bg-transparent px-3.5 text-sm text-ink outline-none ${compact ? "py-1.5" : "py-2.5"}`}
      />
      <span className="flex items-center border-l border-line bg-page-bg px-3 text-sm text-ink/50">
        {suffix}
      </span>
    </div>
  );
}

/** Two or more choices shown as buttons; the chosen one is highlighted. */
function Segmented({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon: React.ReactNode }[];
  label: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`flex items-center justify-center gap-2 rounded-lg border px-2.5 py-2.5 text-xs font-medium transition sm:text-[13px] ${
              selected
                ? "border-primary bg-primary-light text-primary"
                : "border-line bg-white text-ink/60 hover:bg-page-bg"
            }`}
          >
            <span className="shrink-0">{o.icon}</span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  id,
  checked,
  onChange,
  label,
  hint,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          checked ? "bg-primary" : "bg-ink/20"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
      <div>
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-ink">
          {label}
        </label>
        {hint && <p className="mt-1 text-xs text-ink/45">{hint}</p>}
      </div>
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
  const iconClass = "h-4 w-4";

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className={cardClass}>
        <h2 className="font-heading text-xl font-semibold text-ink">Program defaults</h2>
        <p className="mt-1 text-sm text-ink/55">
          Applied to affiliates approved from now on. Existing affiliates keep the terms they were
          approved with.
        </p>

        <div className="mt-6 grid gap-y-7 md:grid-cols-3">
          <div className="md:pr-8">
            <Field label="Commission type">
              <Segmented
                label="Commission type"
                value={v.defaultCommissionType}
                onChange={(val) => set("defaultCommissionType", val)}
                options={[
                  { value: "percent", label: "Percentage of order", icon: <Percent className={iconClass} /> },
                  { value: "fixed", label: "Fixed amount per order", icon: <CircleDollarSign className={iconClass} /> },
                ]}
              />
            </Field>
          </div>
          <div className="md:border-l md:border-line md:px-8">
            <Field label={percent ? "Commission rate (%)" : "Commission per order ($)"}>
              <SuffixInput
                suffix={percent ? "%" : "$"}
                step="0.01"
                min={0}
                value={v.defaultCommissionRate}
                onChange={(e) => set("defaultCommissionRate", num(e))}
              />
            </Field>
          </div>
          <div className="md:border-l md:border-line md:pl-8">
            <Field
              label="Commission is calculated on"
              hint="After-coupon means affiliates aren't paid on money the store discounted away."
            >
              <Segmented
                label="Commission is calculated on"
                value={v.defaultCommissionOn}
                onChange={(val) => set("defaultCommissionOn", val)}
                options={[
                  { value: "subtotal_after_coupon", label: "Subtotal after discount", icon: <ShoppingCart className={iconClass} /> },
                  { value: "subtotal_before_coupon", label: "Subtotal before discount", icon: <CircleDollarSign className={iconClass} /> },
                ]}
              />
            </Field>
          </div>

          <div className="md:pr-8">
            <Field label="Team override (%)" hint="Paid to the affiliate who recruited the seller.">
              <SuffixInput
                suffix="%"
                step="0.01"
                min={0}
                max={100}
                value={v.defaultParentOverrideRate}
                onChange={(e) => set("defaultParentOverrideRate", num(e))}
              />
            </Field>
          </div>
          <div className="md:border-l md:border-line md:px-8">
            <Field
              label="New affiliates can recruit a team"
              hint="Applies to affiliates approved from now on. You can change it per affiliate on their page."
            >
              <div className="flex h-[42px] items-center">
                <Toggle
                  id="default-can-recruit"
                  checked={v.defaultCanRecruit}
                  onChange={(c) => set("defaultCanRecruit", c)}
                  label="Allow recruiting"
                />
              </div>
            </Field>
          </div>
          <div className="md:border-l md:border-line md:pl-8">
            <Field label="Referral cookie (days)" hint="How long a click stays attributable.">
              <SuffixInput
                suffix="days"
                min={1}
                max={365}
                value={v.defaultCookieDurationDays}
                onChange={(e) => set("defaultCookieDurationDays", num(e))}
              />
            </Field>
          </div>
        </div>

        <div className="mt-7 grid gap-x-8 gap-y-7 md:grid-cols-2">
          <Field label="Pending period (days)" hint="Commissions wait this long before becoming payable.">
            <SuffixInput
              suffix="days"
              min={0}
              max={365}
              value={v.defaultPendingPeriodDays}
              onChange={(e) => set("defaultPendingPeriodDays", num(e))}
            />
          </Field>
          <Field label="Minimum payout ($)">
            <SuffixInput
              suffix="$"
              step="0.01"
              min={0}
              value={v.defaultMinimumPayoutThreshold}
              onChange={(e) => set("defaultMinimumPayoutThreshold", num(e))}
            />
          </Field>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="font-heading text-xl font-semibold text-ink">Unilevel compensation plan</h2>
        <p className="mt-1 text-sm text-ink/55">
          Sellers earn a tiered rate on their monthly sales, and up to five qualified uplines earn
          overrides. When off, the flat commission and single team override above apply.
        </p>

        <div className="mt-6 grid gap-y-6 md:grid-cols-2">
          <div className="md:pr-8">
            <Toggle
              id="unilevel-enabled"
              checked={v.unilevelEnabled}
              onChange={(c) => set("unilevelEnabled", c)}
              label="Use the unilevel plan for new orders"
              hint="Only affects orders placed after you save. Existing commissions are not recalculated."
            />
          </div>
          <div className="md:border-l md:border-line md:pl-8">
            <Toggle
              id="membership-commission"
              checked={v.membershipCommissionEnabled}
              onChange={(c) => set("membershipCommissionEnabled", c)}
              label="Pay reps commission on membership payments"
              hint="When a customer a rep referred pays their monthly membership, the rep earns commission on it like a product sale (and uplines earn overrides if the unilevel plan is on). Off until the client confirms membership fees count as sales."
            />
          </div>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="min-w-0 rounded-xl border border-line p-4">
            <h3 className="font-heading text-base font-semibold text-ink">
              Seller tiers (by monthly personal sales)
            </h3>
            <div className="mt-3">
              <div>
                <div className="hidden grid-cols-[1.1fr_1fr_1fr] gap-3 rounded-lg bg-page-bg px-3 py-2 text-xs font-medium text-ink/60 sm:grid">
                  <span>Tier</span>
                  <span>Minimum monthly sales ($)</span>
                  <span>Seller rate (%)</span>
                </div>
                {v.unilevelSellerTiers.map((t, i) => (
                  <div
                    key={t.name}
                    className="grid grid-cols-2 items-end gap-x-3 gap-y-2 border-b border-line px-3 py-3 last:border-0 sm:grid-cols-[1.1fr_1fr_1fr] sm:items-center"
                  >
                    <span className="col-span-2 text-sm font-medium text-ink/80 sm:col-span-1 sm:font-normal">
                      {t.name}
                    </span>
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[11px] text-ink/50 sm:hidden">Min. monthly sales ($)</span>
                      <input
                        type="number"
                        min={0}
                        disabled={i === 0}
                        aria-label={`${t.name} minimum monthly sales`}
                        className={compactInputClass}
                        value={t.minMonthlySales}
                        onChange={(e) => setTier(i, { minMonthlySales: num(e) })}
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[11px] text-ink/50 sm:hidden">Seller rate (%)</span>
                      <SuffixInput
                        compact
                        suffix="%"
                        step="0.01"
                        min={0}
                        max={100}
                        aria-label={`${t.name} rate percent`}
                        value={t.rate}
                        onChange={(e) => setTier(i, { rate: num(e) })}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-line p-4">
            <h3 className="font-heading text-base font-semibold text-ink">Override rates by paid slot (%)</h3>
            <div className="mt-3">
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-page-bg px-3 py-2 text-xs font-medium text-ink/60">
                <span>Slot</span>
                <span>Override rate (%)</span>
              </div>
              {v.unilevelSlotRates.map((r, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 items-center gap-3 border-b border-line px-3 py-2 last:border-0"
                >
                  <span className="text-sm text-ink/80">Slot {i + 1}</span>
                  <SuffixInput
                    compact
                    suffix="%"
                    step="0.01"
                    min={0}
                    max={100}
                    aria-label={`Slot ${i + 1} override rate percent`}
                    value={r}
                    onChange={(e) => setSlot(i, num(e))}
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink/45">
              Slot 1 goes to the first qualified upline, slot 2 to the next, and so on. Unqualified
              uplines are skipped. Unfilled slots stay with the company.
            </p>
          </div>
        </div>

        <div className="mt-7 grid gap-x-6 gap-y-6 md:grid-cols-3">
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

      <section className={cardClass}>
        <h2 className="font-heading text-xl font-semibold text-ink">Wallet points</h2>
        <p className="mt-1 text-sm text-ink/55">
          Active members earn points they can turn into store credit. 1 point = $1. Existing balances
          and codes are never changed by these settings.
        </p>

        <div className="mt-6">
          <Toggle
            id="wallet-enabled"
            checked={v.walletEnabled}
            onChange={(c) => set("walletEnabled", c)}
            label="Turn on wallet points"
            hint="When off, nobody earns new points and nobody can redeem. Balances are kept."
          />
        </div>

        <div className="mt-7 grid gap-x-6 gap-y-6 md:grid-cols-3">
          <Field
            label="Earn rate on store orders (%)"
            hint="Share of an order, after discounts, returned as points. Shipping and fees never count."
          >
            <SuffixInput
              suffix="%"
              step="0.1"
              min={0}
              max={100}
              value={v.walletOrderEarnPercent}
              onChange={(e) => set("walletOrderEarnPercent", num(e))}
            />
          </Field>
          <Field
            label="Minimum order to earn ($)"
            hint="The order subtotal, before discounts, must reach this. 0 = every order earns."
          >
            <SuffixInput
              suffix="$"
              min={0}
              value={v.walletOrderMinSubtotal}
              onChange={(e) => set("walletOrderMinSubtotal", num(e))}
            />
          </Field>
          <Field
            label="Earn rate on membership payments (%)"
            hint="Share of each monthly membership payment returned as points. 0 = none."
          >
            <SuffixInput
              suffix="%"
              step="0.1"
              min={0}
              max={100}
              value={v.walletMembershipEarnPercent}
              onChange={(e) => set("walletMembershipEarnPercent", num(e))}
            />
          </Field>
          <Field label="Smallest redemption (points)" hint="The least a member can turn into a code at once.">
            <SuffixInput
              suffix="pts"
              step="0.01"
              min={0.01}
              value={v.walletMinRedeem}
              onChange={(e) => set("walletMinRedeem", num(e))}
            />
          </Field>
          <Field
            label="Code valid for (days)"
            hint="An unused code expires after this long and its points go back to the member."
          >
            <SuffixInput
              suffix="days"
              min={1}
              max={365}
              value={v.walletRedeemExpiryDays}
              onChange={(e) => set("walletRedeemExpiryDays", num(e))}
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-4">
        {error && <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}
        {status === "saved" && <span className="text-sm text-emerald-700">Settings saved.</span>}
        <button
          type="submit"
          disabled={status === "saving"}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {status === "saving" ? "Saving…" : "Save defaults"}
        </button>
      </div>
    </form>
  );
}
