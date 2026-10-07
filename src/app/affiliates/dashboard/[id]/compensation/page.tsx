import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAffiliateAccess } from "@/lib/affiliates/access";
import { getCompensationOverview } from "@/lib/affiliates/compensation";
import DashboardShell from "../DashboardShell";
import { hasMembership } from "@/lib/customers/crossLinks";
import { Card, Table, fmtDate } from "../ui";
import { canSeeTeam } from "@/lib/affiliates/team";

export const dynamic = "force-dynamic";

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2)}%`;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="animate-fade-up min-w-0 rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="text-xs text-ink/60">{label}</div>
      <div className="mt-2 font-heading text-[26px] font-semibold leading-none text-ink">{value}</div>
      {hint && <div className="mt-1.5 text-xs text-ink/45">{hint}</div>}
    </div>
  );
}

function Check({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          ok ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
        }`}
        aria-label={ok ? "Met" : "Not met yet"}
      >
        {ok ? "✓" : "!"}
      </span>
      <div>
        <div className="text-sm font-medium text-ink">{title}</div>
        <div className="text-xs text-ink/55">{detail}</div>
      </div>
    </li>
  );
}

export default async function CompensationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAffiliateAccess(id);

  const affiliate = await prisma.affiliate.findUnique({ where: { id } });
  if (!affiliate) notFound();

  const c = await getCompensationOverview(id);
  const q = c.qualification;

  const appBaseUrl = process.env.APP_BASE_URL ?? "";
  const referralLink = `${appBaseUrl}/ref/${affiliate.referralSlug}`;

  return (
    <DashboardShell
      affiliateId={affiliate.id}
      affiliateEmail={affiliate.userEmail}
      displayName={affiliate.displayName}
      referralLink={referralLink}
      discountCode={affiliate.shopifyDiscountCode}
      showTeam={await canSeeTeam(affiliate)}
      hasMembership={await hasMembership(affiliate.userEmail)}
    >
      <div className="space-y-6 p-4 md:p-6">
        <div className="animate-fade-up">
          <h1 className="font-heading text-2xl font-semibold text-ink">Compensation</h1>
          <p className="mt-1 text-sm text-ink/60">
            How you earn, and where you stand in {c.monthLabel}.
          </p>
        </div>

        {!c.enabled && (
          <Card title="Your commission">
            <p className="text-sm text-ink/70">
              You currently earn a flat <strong className="text-ink">{pct(c.flatRate)}</strong> on every
              order placed through your link or code.
            </p>
            <p className="mt-2 text-sm text-ink/70">
              The tiered plan is coming: your rate grows with your monthly sales, and you can earn
              overrides on your team&apos;s sales. Your progress will show up here when it starts.
            </p>
            <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              {c.tiers.map((t) => (
                <li key={t.name} className="rounded-xl border border-line px-3.5 py-3">
                  <div className="font-medium text-ink">{t.name}</div>
                  <div className="text-xs text-ink/55">
                    {t.minMonthlySales === 0 ? "Any monthly sales" : `${usd(t.minMonthlySales)}+ a month`}
                  </div>
                  <div className="mt-1 font-heading text-lg font-semibold text-primary">{pct(t.rate)}</div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {c.enabled && (
          <>
            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Stat label={`Your sales, ${c.monthLabel}`} value={usd(c.sales)} />
              <Stat label="Your commission rate" value={pct(c.tier.rate)} hint={c.tier.name} />
              <Stat
                label="Override earnings this month"
                value={usd(c.overrideEarnedThisMonth)}
                hint={`${usd(c.overrideEarnedLifetime)} all time`}
              />
              <Stat
                label="Your team"
                value={String(c.teamSize)}
                hint={`${q.directRecruits} recruited directly`}
              />
            </section>

            <Card title="Your seller tier" delay={80}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="font-heading text-xl font-semibold text-ink">{c.tier.name}</span>
                  <span className="ml-2 text-sm text-ink/55">earning {pct(c.tier.rate)}</span>
                </div>
                {c.nextTier ? (
                  <span className="text-sm text-ink/70">
                    <strong className="text-ink">{usd(c.toNextTier)}</strong> more this month reaches{" "}
                    {c.nextTier.name} ({pct(c.nextTier.rate)})
                  </span>
                ) : (
                  <span className="text-sm font-medium text-emerald-700">You&apos;re at the top tier</span>
                )}
              </div>
              <div
                className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-primary-light"
                role="progressbar"
                aria-valuenow={Math.round(c.tierProgress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progress to the next tier"
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${c.tierProgress * 100}%` }} />
              </div>
              <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                {c.tiers.map((t) => {
                  const current = t.name === c.tier.name;
                  return (
                    <li
                      key={t.name}
                      className={`rounded-xl border px-3.5 py-3 ${current ? "border-primary bg-primary-light/50" : "border-line"}`}
                    >
                      <div className="font-medium text-ink">{t.name}</div>
                      <div className="text-xs text-ink/55">
                        {t.minMonthlySales === 0 ? "Any monthly sales" : `${usd(t.minMonthlySales)}+ a month`}
                      </div>
                      <div className="mt-1 font-heading text-lg font-semibold text-primary">{pct(t.rate)}</div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-ink/45">
                Your rate follows your sales so far this month, and starts over each month.
              </p>
            </Card>

            {c.activity && (
              <Card title="Activity cycle" delay={100}>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      c.activity.active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {c.activity.active ? "Active" : "Not active yet"}
                  </span>
                  <span className="text-sm text-ink/60">
                    {c.activity.daysLeft} day{c.activity.daysLeft === 1 ? "" : "s"} left in this {c.activity.cycleDays}-day cycle
                  </span>
                </div>
                <ul className="space-y-4">
                  <Check
                    ok={c.activity.recruits >= c.activity.requiredRecruits}
                    title={`Recruit ${c.activity.requiredRecruits} affiliates this cycle`}
                    detail={`${c.activity.recruits} of ${c.activity.requiredRecruits} so far.`}
                  />
                  {c.activity.minSales > 0 && (
                    <Check
                      ok={c.activity.sales >= c.activity.minSales}
                      title={`Or reach ${usd(c.activity.minSales)} in your own sales`}
                      detail={`${usd(c.activity.sales)} so far this cycle.`}
                    />
                  )}
                </ul>
                <p className="mt-4 text-xs text-ink/45">
                  Meet either one before the cycle ends and you stay active with a fresh cycle. Miss it and your
                  account is suspended. We email you 14 and 3 days before.
                </p>
              </Card>
            )}

            <Card title="Override qualification" delay={120}>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    q.qualified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {q.qualified ? (c.activity ? "Qualified" : "Qualified this month") : c.activity ? "Not qualified yet" : "Not qualified yet this month"}
                </span>
                <span className="text-sm text-ink/60">
                  {q.qualified
                    ? "You're earning overrides on your team's sales."
                    : "Until you meet the requirements, your override share on your team's sales goes to the next qualified person above you."}
                </span>
              </div>
              {c.activity ? (
                <ul className="space-y-4">
                  <Check
                    ok={c.activity.active}
                    title="Be active"
                    detail={c.activity.active ? "You're active this cycle." : "Meet the activity requirement above."}
                  />
                  <Check
                    ok={q.meetsRecruits}
                    title={`Have ${q.requiredRecruits} active recruits`}
                    detail={`${q.activeRecruits} of ${q.requiredRecruits} so far (a recruit counts once they've met the requirement themselves).`}
                  />
                </ul>
              ) : (
              <>
              <ul className="space-y-4">
                <Check
                  ok={q.meetsRecruits}
                  title={`Recruit ${q.requiredRecruits} active agents`}
                  detail={`${q.activeRecruits} of ${q.requiredRecruits} so far${
                    q.activeRecruitMinSales > 0
                      ? ` (a recruit counts once they've sold ${usd(q.activeRecruitMinSales)} this month)`
                      : ""
                  }.`}
                />
                <Check
                  ok={q.meetsSales}
                  title={
                    q.minPersonalSales > 0
                      ? `Reach ${usd(q.minPersonalSales)} in personal sales this month`
                      : "Personal sales requirement"
                  }
                  detail={
                    q.minPersonalSales > 0
                      ? `${usd(c.sales)} so far this month.`
                      : "There's no minimum right now."
                  }
                />
              </ul>
              <p className="mt-4 text-xs text-ink/45">Both are checked every month.</p>
              </>
              )}
            </Card>

            <Card title={`Override earnings, ${c.monthLabel}`} delay={160}>
              <p className="mb-3 text-sm text-ink/60">
                When someone on your team sells, the first {c.slots.length} qualified people above them
                are paid, nearest first. You earn the slot you fill.
              </p>
              <Table
                headers={["Paid slot", "Rate", "Sales", "You earned"]}
                rows={c.slots.map((s) => [
                  `Slot ${s.slot}`,
                  pct(s.rate),
                  String(s.sales),
                  <span key={s.slot} className="font-medium text-ink">
                    {usd(s.earned)}
                  </span>,
                ])}
                empty="No overrides yet."
              />
              <div className="mt-3 text-sm text-ink/70">
                Total this month: <strong className="text-ink">{usd(c.overrideEarnedThisMonth)}</strong>
              </div>
            </Card>

            <section className="grid gap-6 xl:grid-cols-2">
              <Card title="Your team by level" delay={200}>
                {c.levels.length === 0 ? (
                  <p className="text-sm text-ink/60">
                    {affiliate.canRecruit
                      ? "No one has joined your team yet. Share your invite link from the Team page."
                      : "No one is on your team. Team building isn't enabled for your account."}
                  </p>
                ) : (
                  <ul className="space-y-2.5 text-sm">
                    {c.levels.map((n, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <span className="w-16 shrink-0 text-ink/60">Level {i + 1}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary-light">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${(n / Math.max(...c.levels)) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right font-medium text-ink">{n}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-xs text-ink/45">
                  Everyone you recruited, and who they recruited, at any depth.
                </p>
              </Card>

              <Card title="Recent override earnings" delay={240}>
                <Table
                  headers={["Date", "Level", "Slot", "You earned"]}
                  rows={c.recent.map((r) => [
                    fmtDate(r.createdAt),
                    `Level ${r.level}`,
                    `Slot ${r.slot} · ${pct(r.rate)}`,
                    <span key={r.id} className="font-medium text-ink">
                      {usd(r.amount)}
                    </span>,
                  ])}
                  empty="Overrides from your team's sales will show up here."
                />
              </Card>
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
