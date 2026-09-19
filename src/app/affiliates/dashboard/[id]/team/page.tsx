import { Fragment } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Avatar from "@/components/Avatar";
import KpiCard from "@/components/KpiCard";
import StatusPill from "@/components/StatusPill";
import { formatMoney } from "@/lib/format";
import { getTeamOverview } from "@/lib/affiliates/dashboardData";
import { requireAffiliateAccess } from "@/lib/affiliates/access";
import DashboardShell from "../DashboardShell";
import CopyableRow from "../CopyableRow";
import { fmtDate } from "../ui";


export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAffiliateAccess(id);

  const affiliate = await prisma.affiliate.findUnique({ where: { id } });
  if (!affiliate) notFound();

  const { members, kpis, days } = await getTeamOverview(id);

  const appBaseUrl = process.env.APP_BASE_URL ?? "";
  const referralLink = `${appBaseUrl}/ref/${affiliate.referralSlug}`;
  const inviteLink = `${appBaseUrl}/affiliates/apply?ref=${affiliate.referralSlug}`;

  return (
    <DashboardShell
      affiliateId={affiliate.id}
      affiliateEmail={affiliate.userEmail}
      displayName={affiliate.displayName}
      referralLink={referralLink}
      discountCode={affiliate.shopifyDiscountCode}
    >
      <div className="space-y-6 p-4 md:p-6">
        <div className="animate-fade-up">
          <h1 className="font-heading text-2xl font-semibold text-ink">Your Team</h1>
          <p className="mt-1 text-sm text-ink/60">
            People you&apos;ve recruited into the affiliate program.
          </p>
        </div>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            index={0}
            label="Team Members"
            value={kpis.members.value}
            icon="users"
            change={kpis.members.change}
            days={days}
          />
          <KpiCard
            index={1}
            label="Team Conversions"
            value={kpis.conversions.value}
            icon="chart"
            change={kpis.conversions.change}
            days={days}
          />
          <KpiCard
            index={2}
            label="Earned from Team"
            value={kpis.earnings.value}
            format="money"
            icon="dollar"
            change={kpis.earnings.change}
            days={days}
          />
          <KpiCard
            index={3}
            label="Second-level Members"
            value={kpis.secondLevel.value}
            icon="pie"
            change={kpis.secondLevel.change}
            days={days}
          />
        </section>

        <section
          className="animate-fade-up rounded-2xl border border-line bg-white p-5 shadow-sm"
          style={{ "--delay": "150ms" } as React.CSSProperties}
        >
          <h2 className="font-heading text-lg font-semibold text-ink">Invite someone</h2>
          <p className="mb-4 mt-1 text-sm text-ink/60">
            Anyone who applies through this link joins your team once approved.
          </p>
          <div className="text-sm">
            <CopyableRow label="Invite link" value={inviteLink} />
          </div>
        </section>

        <section
          className="animate-fade-up rounded-2xl border border-line bg-white p-5 shadow-sm"
          style={{ "--delay": "220ms" } as React.CSSProperties}
        >
          <h2 className="mb-4 font-heading text-lg font-semibold text-ink">Members</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-page-bg text-left text-xs font-medium text-ink/60">
                  <th className="rounded-l-xl px-3 py-3">Affiliate</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Conversions</th>
                  <th className="px-3 py-3">Their earnings</th>
                  <th className="px-3 py-3">Earned for you</th>
                  <th className="px-3 py-3">Their team</th>
                  <th className="rounded-r-xl px-3 py-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <Fragment key={m.id}>
                    <tr
                      className={`border-line ${m.subAffiliates.length === 0 ? "border-b last:border-0" : ""}`}
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={m.displayName || m.userEmail} />
                          <span>
                            <span className="block font-medium text-ink">
                              {m.displayName || m.userEmail}
                            </span>
                            {m.displayName && (
                              <span className="block text-xs text-ink/50">{m.userEmail}</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill status={m.status} />
                      </td>
                      <td className="px-3 py-3 text-ink/70">{m.totalConversions}</td>
                      <td className="px-3 py-3 text-ink/70">
                        {formatMoney(m.totalCommissionEarned)}
                      </td>
                      <td className="px-3 py-3 font-medium text-ink">
                        {formatMoney(m.earnedFromThem)}
                      </td>
                      <td className="px-3 py-3 text-ink/70">{m.subAffiliates.length}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink/70">
                        {fmtDate(m.createdAt)}
                      </td>
                    </tr>
                    {m.subAffiliates.length > 0 && (
                      <tr className="border-b border-line last:border-0">
                        <td colSpan={7} className="px-3 pb-3 pt-0">
                          <div className="ml-10 rounded-xl bg-page-bg px-4 py-3">
                            <p className="mb-2 text-xs font-medium text-ink/50">
                              On {m.displayName || "their"} team
                            </p>
                            <ul className="space-y-1.5">
                              {m.subAffiliates.map((sub) => (
                                <li
                                  key={sub.id}
                                  className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/70"
                                >
                                  <span className="min-w-[8rem] font-medium text-ink">
                                    {sub.displayName || sub.userEmail}
                                  </span>
                                  <StatusPill status={sub.status} />
                                  <span>{sub.totalConversions} conversions</span>
                                  <span>{formatMoney(sub.totalCommissionEarned)} earned</span>
                                  <span>Joined {fmtDate(sub.createdAt)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {members.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-ink/40">
                      No one has joined your team yet. Share your invite link to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
