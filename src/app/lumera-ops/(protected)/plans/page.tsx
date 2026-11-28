import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import { getCatalog } from "@/lib/membership/plans.server";
import { DEFAULT_PLANS, DEFAULT_TEST_KIT_PRICE, PLAN_KEYS, type PlanKey } from "@/lib/membership/plans";
import PlansEditor, { type PlanCardData } from "./PlansEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Membership plans" };

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Admin: customize the membership packages for customers and sales reps.
export default async function PlansPage() {
  await requireAdminPage();
  const [catalog, configs, settings, counts] = await Promise.all([
    getCatalog(),
    prisma.membershipPlanConfig.findMany(),
    prisma.membershipSettings.findUnique({ where: { id: "global" } }),
    prisma.customerSignup.groupBy({ by: ["plan"], where: { status: { not: "cancelled" } }, _count: { _all: true } }),
  ]);

  const members = new Map(counts.map((c) => [c.plan, c._count._all]));
  const cards: PlanCardData[] = PLAN_KEYS.map((key: PlanKey) => {
    const plan = catalog.plans[key];
    const cfg = configs.find((c) => c.key === key);
    return {
      key,
      audience: plan.audience,
      name: plan.name,
      monthlyPrice: plan.monthlyPrice,
      listPrice: plan.listPrice ?? null,
      webDiscountPercent: plan.webDiscountPercent,
      consultations: plan.consultations,
      testKitPrice: plan.testKitPrice ?? null,
      benefits: plan.benefits,
      customized: !!cfg,
      updatedLabel: cfg ? `Last changed ${fmtDate(cfg.updatedAt)}${cfg.updatedBy ? ` by ${cfg.updatedBy}` : ""}` : null,
      members: members.get(key) ?? 0,
      defaults: {
        name: DEFAULT_PLANS[key].name,
        monthlyPrice: DEFAULT_PLANS[key].monthlyPrice,
      },
    };
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-ink">Membership plans</h1>
        <p className="mt-1.5 max-w-3xl text-sm font-medium text-ink/60">
          Customize what each package costs and includes, for customers and for sales reps. Changes show up on the signup
          pages, payment pages and member accounts straight away. Members who already pay keep the monthly price they signed
          up at; new signups and renewals of lapsed memberships use the new price.
        </p>
      </div>

      <PlansEditor
        cards={cards}
        testKit={{ price: catalog.testKitPrice, customized: settings?.testKitPrice != null, defaultPrice: DEFAULT_TEST_KIT_PRICE }}
      />
    </div>
  );
}
