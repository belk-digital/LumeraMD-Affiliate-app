import { requireCustomer } from "@/lib/customers/requireCustomer";
import { prisma } from "@/lib/prisma";
import { PLANS, type PlanKey } from "@/lib/membership/plans";
import Icon from "@/components/Icon";
import AccountShell from "../AccountShell";
import { affiliateIdFor } from "@/lib/customers/crossLinks";
import { Badge, ButtonLink, Card, DataTable, Page, PageHeader, StatCard, fmtDate } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consultations · LumeraMD" };

const OPS_EMAIL = process.env.AFFILIATE_OPS_EMAIL ?? "info@lumeramd.com";

export default async function ConsultationsPage() {
  const customer = await requireCustomer();
  const plan = PLANS[customer.plan as PlanKey];
  const included = plan?.consultations ?? 0;
  const left = Math.max(included - customer.consultationsUsed, 0);
  const history = await prisma.memberConsultation.findMany({
    where: { customerId: customer.id },
    orderBy: { occurredAt: "desc" },
    take: 50,
  });

  return (
    <AccountShell
      name={`${customer.firstName} ${customer.lastName}`.trim()}
      email={customer.email}
      affiliateId={await affiliateIdFor(customer.email)}
    >
      <Page>
        <PageHeader title="Consultations" subtitle="Telehealth consultations included with your plan." />

        {included === 0 ? (
          <Card title="Not included in your plan" icon="calendar">
            <p className="text-sm text-ink/60">
              Plus includes 1 consultation and Premium includes 2. You can change plans any time.
            </p>
            <div className="mt-4">
              <ButtonLink href="/account/membership">Compare plans</ButtonLink>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard icon="calendar" label="Included" value={included} />
              <StatCard icon="check" label="Used" value={customer.consultationsUsed} />
              <StatCard icon="calendar" label="Remaining" value={left} />
            </div>
            <Card title="Book a consultation" icon="mail">
              <p className="text-sm text-ink/60">
                Email {" "}
                <a href={`mailto:${OPS_EMAIL}`} className="font-medium text-primary hover:underline">{OPS_EMAIL}</a>{" "}
                and we&apos;ll get you scheduled.
              </p>
              <div className="mt-4">
                <ButtonLink href={`mailto:${OPS_EMAIL}?subject=Book%20a%20consultation`}>
                  <Icon name="mail" className="h-4 w-4" /> Email to book
                </ButtonLink>
              </div>
            </Card>
          </>
        )}

        <Card title="History" icon="chart">
          <DataTable
            headers={["Date", "Consultation", "Status", "Notes"]}
            empty="No consultations yet."
            rows={history.map((h) => [
              fmtDate(h.occurredAt),
              <span key={h.id} className="font-medium text-ink">{h.title}</span>,
              <Badge key={`s${h.id}`} tone={h.status === "completed" ? "green" : "slate"}>
                {h.status.charAt(0).toUpperCase() + h.status.slice(1)}
              </Badge>,
              h.notes ?? "—",
            ])}
          />
        </Card>

        <p className="text-center text-xs text-ink/45">
          Need help? Email <a href={`mailto:${OPS_EMAIL}`} className="text-primary hover:underline">{OPS_EMAIL}</a>
        </p>
      </Page>
    </AccountShell>
  );
}
