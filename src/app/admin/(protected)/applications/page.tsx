import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import ApplicationsTable from "../_components/ApplicationsTable";

const TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
] as const;

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdminPage();

  const raw = (await searchParams).status;
  const status = TABS.some((t) => t.key === raw) ? (raw as (typeof TABS)[number]["key"]) : "all";

  const [applications, groups] = await Promise.all([
    prisma.affiliateApplication.findMany({
      where: status === "all" ? {} : { status },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.affiliateApplication.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const count = (key: string) =>
    key === "all"
      ? groups.reduce((acc, g) => acc + g._count._all, 0)
      : (groups.find((g) => g.status === key)?._count._all ?? 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Applications</h1>
        <p className="mt-1 text-sm text-ink/60">Review and approve people applying to the program.</p>
      </div>

      <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.key === "all" ? "/admin/applications" : `/admin/applications?status=${tab.key}`}
              className={`rounded-xl px-4 py-2 text-sm transition ${
                status === tab.key
                  ? "bg-primary font-medium text-white"
                  : "border border-line text-ink/60 hover:bg-page-bg"
              }`}
            >
              {tab.label}
              <span className={`ml-2 text-xs ${status === tab.key ? "text-white/70" : "text-ink/40"}`}>
                {count(tab.key)}
              </span>
            </Link>
          ))}
        </div>

        <ApplicationsTable
          applications={applications}
          emptyMessage={
            status === "all" ? "No applications yet." : `No ${status} applications.`
          }
        />
      </div>
    </div>
  );
}
