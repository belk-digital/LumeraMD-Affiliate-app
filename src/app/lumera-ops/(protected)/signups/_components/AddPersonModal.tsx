"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import PhoneField from "@/components/PhoneField";
import { cleanEmail, cleanName, NAME_MAX } from "@/lib/fields";
import { CUSTOMER_PLANS, PLANS } from "@/lib/membership/plans";
import { Backdrop, inputClass, Notice, useCopy } from "./kit";

type Kind = "member" | "rep";

const labelClass = "mb-1.5 block text-xs font-semibold text-ink/70";

/** The "Add member" / "Add sales rep" button and its form. The admin picks recurring payment or free. */
export default function AddPersonButton({ kind }: { kind: Kind }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark lg:w-auto"
      >
        <Plus className="h-4 w-4" />
        {kind === "member" ? "Add member" : "Add sales rep"}
      </button>
      {open && <AddPersonModal kind={kind} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddPersonModal({ kind, onClose }: { kind: Kind; onClose: () => void }) {
  const router = useRouter();
  const { copied, copy } = useCopy();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    plan: CUSTOMER_PLANS[0].key as string,
    wantsTestKit: false,
    sponsorId: "",
    billing: "recurring" as "recurring" | "free",
    note: "",
  });
  const [sponsors, setSponsors] = useState<{ id: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ payLink: string | null; warnings: string[] } | null>(null);

  useEffect(() => {
    fetch("/api/lumera-ops/signups/sponsors")
      .then((r) => (r.ok ? r.json() : { sponsors: [] }))
      .then((d) => setSponsors(d.sponsors ?? []))
      .catch(() => {});
  }, []);

  const plan = kind === "rep" ? PLANS.agent : PLANS[form.plan as keyof typeof PLANS];
  const word = kind === "member" ? "member" : "sales rep";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/lumera-ops/signups/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Could not add this ${word}.`);
        return;
      }
      router.refresh();
      setDone({ payLink: data.payLink ?? null, warnings: data.warnings ?? [] });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Backdrop onClose={() => !busy && onClose()}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        {done ? (
          <div className="space-y-4 p-6">
            <h3 className="font-heading text-lg font-bold text-ink">
              {form.firstName} {form.lastName} was added
            </h3>
            <p className="text-sm text-ink/70">
              {form.billing === "free"
                ? `Their ${plan.name} membership is active now, free of charge.`
                : done.payLink
                  ? "They were emailed a link to set up their monthly payment. Their membership starts when the first payment goes through."
                  : "Their membership is waiting for its first payment."}
            </p>
            {done.payLink && (
              <div className="flex items-center gap-2 rounded-lg border border-line bg-page-bg px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-xs text-ink/70">{done.payLink}</span>
                <button type="button" onClick={() => copy(done.payLink!)} className="text-xs font-semibold text-primary">
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            )}
            {done.warnings.map((w) => (
              <Notice key={w} tone="warn">
                {w}
              </Notice>
            ))}
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 p-6">
            <div>
              <h3 className="font-heading text-lg font-bold text-ink">Add {word}</h3>
              <p className="mt-1 text-sm text-ink/60">
                {kind === "member"
                  ? "Add a member yourself. They are emailed and can log in with their email."
                  : "Add a sales rep yourself. They are approved right away, with their login, referral link and discount code."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>First name</label>
                <input
                  required
                  maxLength={NAME_MAX}
                  autoComplete="off"
                  className={inputClass}
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: cleanName(e.target.value) })}
                />
              </div>
              <div>
                <label className={labelClass}>Last name</label>
                <input
                  required
                  maxLength={NAME_MAX}
                  autoComplete="off"
                  className={inputClass}
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: cleanName(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                required
                type="email"
                maxLength={254}
                autoComplete="off"
                className={inputClass}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: cleanEmail(e.target.value) })}
              />
            </div>
            <div>
              <label className={labelClass}>Phone {kind === "member" && <span className="font-normal text-ink/40">(optional)</span>}</label>
              <PhoneField
                required={kind === "rep"}
                inputClass={inputClass}
                onChange={(phone) => setForm((f) => ({ ...f, phone }))}
              />
            </div>

            {kind === "member" ? (
              <div>
                <label className={labelClass}>Plan</label>
                <select className={inputClass} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value, wantsTestKit: false })}>
                  {CUSTOMER_PLANS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name} - ${p.monthlyPrice}/month
                    </option>
                  ))}
                </select>
                {plan.testKitPrice !== undefined && (
                  <label className="mt-2 flex items-center gap-2 text-sm text-ink/70">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-line accent-primary"
                      checked={form.wantsTestKit}
                      onChange={(e) => setForm({ ...form, wantsTestKit: e.target.checked })}
                    />
                    Wants the discounted DNA test kit (${plan.testKitPrice})
                  </label>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-page-bg px-3.5 py-2.5 text-sm text-ink/70">
                Plan: <b className="text-ink">{PLANS.agent.name}</b> - ${PLANS.agent.monthlyPrice}/month, with override commissions.
              </div>
            )}

            <div>
              <label className={labelClass}>
                {kind === "member" ? "Referred by" : "Sponsor (their place in the hierarchy)"}{" "}
                <span className="font-normal text-ink/40">(optional)</span>
              </label>
              <select className={inputClass} value={form.sponsorId} onChange={(e) => setForm({ ...form, sponsorId: e.target.value })}>
                <option value="">{kind === "member" ? "Nobody" : "Nobody (top level)"}</option>
                {sponsors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <fieldset>
              <legend className={labelClass}>Payment</legend>
              <div className="space-y-2">
                {(
                  [
                    ["recurring", "Recurring payment", `They get a payment link by email and are charged $${plan.monthlyPrice} a month once they add a card.`],
                    ["free", "Free (complimentary)", "Active right away. Never charged, and pays no commission."],
                  ] as const
                ).map(([value, title, help]) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      form.billing === value ? "border-primary bg-primary-light/40" : "border-line hover:bg-page-bg"
                    }`}
                  >
                    <input
                      type="radio"
                      name="billing"
                      className="mt-1 accent-primary"
                      checked={form.billing === value}
                      onChange={() => setForm({ ...form, billing: value })}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-ink">{title}</span>
                      <span className="block text-xs text-ink/60">{help}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {form.billing === "free" && (
              <div>
                <label className={labelClass}>Note: who is this and why is it free?</label>
                <textarea
                  required
                  rows={2}
                  maxLength={500}
                  className={inputClass}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </div>
            )}

            {error && <Notice tone="bad">{error}</Notice>}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-ink/70 transition hover:bg-page-bg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
              >
                {busy ? "Adding..." : `Add ${word}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </Backdrop>
  );
}
