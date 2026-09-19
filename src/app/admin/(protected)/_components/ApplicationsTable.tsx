import Avatar from "@/components/Avatar";
import type { AffiliateApplication } from "@/generated/prisma/client";
import ApplicationActions from "./ApplicationActions";
import StatusPill from "@/components/StatusPill";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function ApplicationsTable({
  applications,
  emptyMessage,
}: {
  applications: AffiliateApplication[];
  emptyMessage: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-page-bg text-left text-xs font-medium text-ink/60">
            <th className="rounded-l-xl px-2.5 py-3">Name</th>
            <th className="px-2.5 py-3">Email</th>
            <th className="px-2.5 py-3">Date</th>
            <th className="px-2.5 py-3">Status</th>
            <th className="rounded-r-xl px-2.5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((a) => (
            <tr key={a.id} className="border-b border-line last:border-0">
              <td className="px-2.5 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={a.displayName} />
                  <span className="whitespace-nowrap font-medium text-ink">{a.displayName}</span>
                </div>
              </td>
              <td className="whitespace-nowrap px-2.5 py-3 text-ink/70">{a.email}</td>
              <td className="whitespace-nowrap px-2.5 py-3 text-ink/70">{fmtDate(a.createdAt)}</td>
              <td className="px-2.5 py-3">
                <StatusPill status={a.status} />
              </td>
              <td className="px-2.5 py-3">
                <ApplicationActions
                  id={a.id}
                  status={a.status}
                  linkedAffiliateId={a.linkedAffiliateId}
                />
              </td>
            </tr>
          ))}
          {applications.length === 0 && (
            <tr>
              <td colSpan={5} className="py-12 text-center text-ink/40">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
