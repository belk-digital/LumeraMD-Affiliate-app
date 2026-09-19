import Link from "next/link";
import Avatar from "@/components/Avatar";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import StatusPill from "@/components/StatusPill";

export default async function AdminAffiliatesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdminPage();

  const rawQuery = (await searchParams).q;
  const q = (typeof rawQuery === "string" ? rawQuery : "").trim();

  const affiliates = await prisma.affiliate.findMany({
    where: q
      ? {
          OR: [
            { userEmail: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
            { referralSlug: { contains: q, mode: "insensitive" } },
            { shopifyDiscountCode: { contains: q, mode: "insensitive" } },
            { id: q },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">All Affiliates</h1>
        <p className="mt-1 text-sm text-ink/60">
          {q ? (
            <>
              {affiliates.length} result{affiliates.length === 1 ? "" : "s"} for &ldquo;{q}&rdquo;{" "}
              <Link href="/admin/affiliates" className="text-primary hover:underline">
                Clear search
              </Link>
            </>
          ) : (
            `${affiliates.length} total`
          )}
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-5 shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-page-bg text-left text-xs font-medium text-ink/60">
              <th className="rounded-l-xl px-4 py-3">Affiliate</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Conversions</th>
              <th className="px-4 py-3">Earned</th>
              <th className="rounded-r-xl px-4 py-3">Parent</th>
            </tr>
          </thead>
          <tbody>
            {affiliates.map((a) => (
              <tr key={a.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3.5">
                  <Link
                    href={`/admin/affiliates/${a.id}`}
                    className="flex items-center gap-3 hover:text-primary"
                  >
                    <Avatar name={a.displayName || a.userEmail} />
                    <span>
                      <span className="block font-medium text-ink">
                        {a.displayName || a.userEmail}
                      </span>
                      {a.displayName && (
                        <span className="block text-xs text-ink/50">{a.userEmail}</span>
                      )}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3.5">
                  <StatusPill status={a.status} />
                </td>
                <td className="px-4 py-3.5 font-mono text-xs text-ink/70">
                  {a.shopifyDiscountCode}
                </td>
                <td className="px-4 py-3.5 text-ink/70">{a.totalConversions}</td>
                <td className="px-4 py-3.5 text-ink/70">
                  ${a.totalCommissionEarned.toFixed(2)}
                </td>
                <td className="px-4 py-3.5">
                  {a.parentAffiliateId ? (
                    <Link
                      href={`/admin/affiliates/${a.parentAffiliateId}`}
                      className="text-primary hover:underline"
                    >
                      view
                    </Link>
                  ) : (
                    <span className="text-ink/30">—</span>
                  )}
                </td>
              </tr>
            ))}
            {affiliates.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-ink/40">
                  {q ? "No affiliates match that search." : "No affiliates yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
