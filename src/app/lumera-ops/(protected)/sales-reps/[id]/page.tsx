import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import { prisma } from "@/lib/prisma";
import { monthlyPriceFor, type PlanKey } from "@/lib/membership/plans";
import { getCatalog } from "@/lib/membership/plans.server";
import { authnetConfigured } from "@/lib/authnet/client";
import { initials } from "@/components/Avatar";
import StatusPill from "@/components/StatusPill";
import { formatMoney } from "@/lib/format";
import { shortDate, usd } from "../../signups/_components/fmt";
import MakeComplimentary from "./MakeComplimentary";
import RepProfileActions from "./RepProfileActions";

export const dynamic = "force-dynamic";

const APP_BASE_URL = process.env.APP_BASE_URL ?? "";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col justify-center px-6 py-5">
      <p className="text-xs font-medium text-ink/50">{label}</p>
      <p className="mt-1 truncate font-heading text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white shadow-sm">
      <div className="border-b border-line px-6 py-4">
        <h2 className="font-heading text-base font-semibold text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-ink/50">{hint}</p>}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/60 py-3 text-sm last:border-0">
      <dt className="shrink-0 text-ink/50">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-ink">{children}</dd>
    </div>
  );
}

// The full profile of a sales rep signup: everything the Signups side panel shows, plus (once they are approved)
// their affiliate account, sponsor, team and earnings. Works for pending and rejected applicants too, who
// have no affiliate account to open yet.
export default async function SalesRepProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;

  const rep = await prisma.salesRepSignup.findUnique({ where: { id } });
  if (!rep) notFound();

  const [sponsor, affiliate, membership] = await Promise.all([
    rep.referredByAffiliateId
      ? prisma.affiliate.findUnique({
          where: { id: rep.referredByAffiliateId },
          select: { id: true, displayName: true, userEmail: true },
        })
      : null,
    rep.linkedAffiliateId
      ? prisma.affiliate.findUnique({
          where: { id: rep.linkedAffiliateId },
          include: { _count: { select: { subAffiliates: true } } },
        })
      : null,
    prisma.customerSignup.findFirst({
      where: { plan: "agent", email: { equals: rep.email, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const name = [rep.firstName, rep.lastName].filter(Boolean).join(" ") || rep.email.split("@")[0];
  const plan = rep.plan ? (await getCatalog()).plans[rep.plan as PlanKey] : undefined;
  const price = plan ? (membership ? monthlyPriceFor(membership, plan) : plan.monthlyPrice) : 0;
  const parent = affiliate?.parentAffiliateId
    ? await prisma.affiliate.findUnique({
        where: { id: affiliate.parentAffiliateId },
        select: { id: true, displayName: true, userEmail: true },
      })
    : null;
  const payLink =
    membership && authnetConfigured() && (membership.status === "pending_payment" || membership.status === "past_due")
      ? `${APP_BASE_URL}/pay/${membership.id}`
      : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <Link href="/lumera-ops/signups/sales-reps" className="inline-block text-sm font-medium text-primary hover:underline">
        &larr; Sales reps
      </Link>

      <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm xl:flex-row">
        <div className="flex shrink-0 items-center gap-5 border-b border-line p-6 xl:w-[45%] xl:border-b-0 xl:border-r">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary-light font-heading text-2xl font-bold text-primary">
            {initials(name)}
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-3">
              <h1 className="truncate font-heading text-xl font-bold text-ink">{name}</h1>
              <StatusPill status={rep.status} />
            </div>
            <p className="truncate text-sm font-medium text-ink/80">{rep.email}</p>
            <p className="mt-1 text-xs text-ink/50">Applied {shortDate(rep.createdAt)}</p>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {affiliate ? (
            <>
              <Stat label="Conversions" value={affiliate.totalConversions} />
              <Stat label="Total commission" value={formatMoney(affiliate.totalCommissionEarned)} />
              <Stat label="Direct recruits" value={affiliate._count.subAffiliates} />
            </>
          ) : (
            <>
              <Stat label="Plan" value={plan ? `${plan.name} · ${usd(price)}/mo` : "—"} />
              <Stat label="Annual gross sales" value={rep.annualGrossSales != null ? usd(rep.annualGrossSales) : "—"} />
              <Stat label="Type of sales" value={rep.salesType ?? "—"} />
            </>
          )}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card title="Applicant information" hint="What they submitted on the sales rep signup form.">
            <dl>
              <Row label="Full name">{name}</Row>
              <Row label="Email">
                <a href={`mailto:${rep.email}`} className="text-primary hover:underline">
                  {rep.email}
                </a>
              </Row>
              <Row label="Phone">{rep.phone || "—"}</Row>
              <Row label="Plan">{plan ? `${plan.name} (rep) · ${usd(price)}/mo` : (rep.plan ?? "—")}</Row>
              <Row label="Type of sales">{rep.salesType ?? "—"}</Row>
              <Row label="Annual gross sales">{rep.annualGrossSales != null ? usd(rep.annualGrossSales) : "—"}</Row>
              <Row label="Referred by">{sponsor ? (sponsor.displayName ?? sponsor.userEmail) : "—"}</Row>
              <Row label="Applied on">{shortDate(rep.createdAt)}</Row>
            </dl>
          </Card>

          <Card title="Resume">
            {rep.resumeStorageKey ? (
              <a
                href={`/api/lumera-ops/sales-reps/${rep.id}/resume`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                {rep.resumeFileName ? `Download ${rep.resumeFileName}` : "Download resume"} &rarr;
              </a>
            ) : (
              <p className="text-sm text-ink/50">No resume was attached.</p>
            )}
          </Card>

          <Card title="Review note" hint="Internal only. Added when an application is rejected.">
            {rep.reviewNotes ? (
              <p className="whitespace-pre-wrap text-sm text-ink/80">{rep.reviewNotes}</p>
            ) : (
              <p className="text-sm text-ink/50">No note yet.</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {affiliate ? (
            <Card title="Affiliate account" hint="Created when this signup was approved.">
              <dl>
                <Row label="Status">
                  <StatusPill status={affiliate.status} />
                </Row>
                <Row label="Referral code">{affiliate.referralSlug}</Row>
                <Row label="Discount code">{affiliate.shopifyDiscountCode ?? "—"}</Row>
                <Row label="Sponsor">
                  {parent ? (
                    <Link href={`/lumera-ops/affiliates/${parent.id}`} className="text-primary hover:underline">
                      {parent.displayName ?? parent.userEmail}
                    </Link>
                  ) : (
                    "Top level"
                  )}
                </Row>
                <Row label="Recruiting">{affiliate.canRecruit ? "On" : "Off"}</Row>
                <Row label="Joined">{shortDate(affiliate.createdAt)}</Row>
              </dl>
              <Link
                href={`/lumera-ops/affiliates/${affiliate.id}`}
                className="mt-4 block rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-primary-dark"
              >
                Open affiliate account
              </Link>
            </Card>
          ) : (
            <Card title="Review" hint="Approving creates their affiliate account, referral link and discount code, places them under whoever referred them, and emails them a welcome message and a link to pay for their Premium membership.">
              <RepProfileActions id={rep.id} name={name} email={rep.email} status={rep.status} />
            </Card>
          )}

          {affiliate && membership && (
            <Card title="Premium membership" hint="The monthly fee a rep pays to unlock benefits and overrides.">
              <dl>
                <Row label="Status">
                  <StatusPill status={membership.status} />
                </Row>
                <Row label="Billing">
                  {membership.complimentary ? "Free (complimentary)" : membership.authnetSubscriptionId ? "Monthly by card" : "Manual"}
                </Row>
                {membership.currentPeriodEnd && <Row label="Paid until">{shortDate(membership.currentPeriodEnd)}</Row>}
                {membership.complimentaryNote && <Row label="Note">{membership.complimentaryNote}</Row>}
              </dl>
              {payLink && <p className="mt-3 break-all rounded-lg bg-page-bg px-3 py-2 text-xs text-ink/70">{payLink}</p>}
              {!membership.complimentary && membership.status !== "cancelled" && (
                <MakeComplimentary membershipId={membership.id} billedByCard={!!membership.authnetSubscriptionId} />
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
