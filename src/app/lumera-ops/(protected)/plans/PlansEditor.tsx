"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice } from "../signups/_components/kit";

export interface PlanCardData {
  key: string;
  audience: "agent" | "customer";
  name: string;
  monthlyPrice: number;
  listPrice: number | null;
  webDiscountPercent: number;
  consultations: number;
  testKitPrice: number | null;
  benefits: string[];
  customized: boolean;
  updatedLabel: string | null;
  members: number;
  defaults: { name: string; monthlyPrice: number };
}

const input =
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const label = "mb-1.5 block text-xs font-semibold text-ink/70";

export default function PlansEditor({
  cards,
  testKit,
}: {
  cards: PlanCardData[];
  testKit: { price: number; customized: boolean; defaultPrice: number };
}) {
  const customers = cards.filter((c) => c.audience === "customer");
  const reps = cards.filter((c) => c.audience === "agent");
  return (
    <div className="space-y-8">
      <TestKitCard testKit={testKit} />
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <section className="min-w-0 space-y-4">
          <div>
            <h2 className="font-heading text-xl font-semibold text-ink">Customers</h2>
            <p className="mt-0.5 text-xs text-ink/50">Open a plan to edit it.</p>
          </div>
          <div className="space-y-3">
            {customers.map((c) => (
              <PlanCard key={c.key} card={c} collapsible />
            ))}
          </div>
        </section>
        <section className="min-w-0 space-y-4">
          <div>
            <h2 className="font-heading text-xl font-semibold text-ink">Sales reps</h2>
            <p className="mt-0.5 text-xs text-ink/50">The plan sales reps pay for their membership.</p>
          </div>
          <div className="space-y-3">
            {reps.map((c) => (
              <PlanCard key={c.key} card={c} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function TestKitCard({ testKit }: { testKit: { price: number; customized: boolean; defaultPrice: number } }) {
  const router = useRouter();
  const [price, setPrice] = useState(String(testKit.price));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/lumera-ops/plans/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testKitPrice: price }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ tone: "bad", text: data.error ?? "Could not save." });
      else {
        setMsg({ tone: "good", text: "Saved." });
        router.refresh();
      }
    } catch {
      setMsg({ tone: "bad", text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <h2 className="font-heading text-base font-semibold text-ink">Standard DNA test kit price</h2>
      <p className="mt-0.5 text-xs text-ink/50">
        What anyone without a member price pays. Plans that set their own test kit price below undercut it.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="w-40">
          <label className={label}>Price ($)</label>
          <input className={input} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save"}
        </button>
        {testKit.customized && (
          <span className="pb-2.5 text-xs text-ink/50">Customized (built-in default ${testKit.defaultPrice})</span>
        )}
      </div>
      {msg && (
        <div className="mt-3 max-w-md">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      )}
    </div>
  );
}

function PlanCard({ card, collapsible = false }: { card: PlanCardData; collapsible?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(!collapsible);
  const [form, setForm] = useState({
    name: card.name,
    monthlyPrice: String(card.monthlyPrice),
    listPrice: card.listPrice === null ? "" : String(card.listPrice),
    webDiscountPercent: String(card.webDiscountPercent),
    consultations: String(card.consultations),
    testKitPrice: card.testKitPrice === null ? "" : String(card.testKitPrice),
    benefits: card.benefits.join("\n"),
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function call(method: "PUT" | "DELETE") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/lumera-ops/plans/${card.key}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "PUT" ? JSON.stringify(form) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ tone: "bad", text: data.error ?? "Could not save." });
        return;
      }
      setMsg({ tone: "good", text: method === "PUT" ? "Saved. It is live on the signup and payment pages." : "Back to the built-in defaults." });
      router.refresh();
    } catch {
      setMsg({ tone: "bad", text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-line bg-white shadow-sm">
      <button
        type="button"
        onClick={() => collapsible && setOpen(!open)}
        aria-expanded={open}
        className={`flex w-full items-start justify-between gap-3 p-5 text-left ${open ? "border-b border-line" : ""} ${collapsible ? "cursor-pointer" : "cursor-default"}`}
      >
        <div className="min-w-0">
          <h3 className="font-heading text-lg font-semibold text-ink">
            {card.name}{" "}
            <span className="text-sm font-normal text-ink/50">
              ${card.monthlyPrice}/month
              {card.webDiscountPercent ? ` · ${card.webDiscountPercent}% off web` : ""}
            </span>
          </h3>
          <p className="mt-0.5 text-xs text-ink/50">
            {card.members === 0 ? "No members yet." : `${card.members} ${card.members === 1 ? "member" : "members"} on this plan keep their current price.`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {card.customized && (
            <span className="rounded-full bg-primary-light px-2.5 py-1 text-xs font-medium text-primary">Customized</span>
          )}
          {collapsible && (
            <svg
              className={`h-5 w-5 text-ink/50 transition-transform ${open ? "rotate-180" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {open && <div className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Plan name</label>
            <input className={input} maxLength={40} value={form.name} onChange={set("name")} />
          </div>
          <div>
            <label className={label}>Monthly price ($)</label>
            <input className={input} inputMode="decimal" value={form.monthlyPrice} onChange={set("monthlyPrice")} />
          </div>
          <div>
            <label className={label}>
              Regular price ($) <span className="font-normal text-ink/40">(optional, shown struck through)</span>
            </label>
            <input className={input} inputMode="decimal" value={form.listPrice} onChange={set("listPrice")} />
          </div>
          <div>
            <label className={label}>Web discount (%)</label>
            <input className={input} inputMode="numeric" value={form.webDiscountPercent} onChange={set("webDiscountPercent")} />
          </div>
          <div>
            <label className={label}>Included consultations</label>
            <input className={input} inputMode="numeric" value={form.consultations} onChange={set("consultations")} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>
              Member test kit price ($) <span className="font-normal text-ink/40">(optional, empty = standard price)</span>
            </label>
            <input className={input} inputMode="decimal" value={form.testKitPrice} onChange={set("testKitPrice")} />
          </div>
        </div>

        <div>
          <label className={label}>Benefits shown to customers (one per line)</label>
          <textarea className={input} rows={8} value={form.benefits} onChange={set("benefits")} />
          <p className="mt-1.5 text-xs text-ink/50">
            This is the text people read. The numbers above are what billing and discounts actually use, so keep the two in step.
          </p>
        </div>

        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink/45">{card.updatedLabel ?? "Using the built-in defaults."}</p>
          <div className="flex gap-2">
            {card.customized && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Put ${card.defaults.name} back to its built-in defaults ($${card.defaults.monthlyPrice} a month)?`)) call("DELETE");
                }}
                disabled={busy}
                className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink/70 transition hover:bg-page-bg disabled:opacity-50"
              >
                Reset to defaults
              </button>
            )}
            <button
              type="button"
              onClick={() => call("PUT")}
              disabled={busy}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save plan"}
            </button>
          </div>
        </div>
      </div>}
    </div>
  );
}
