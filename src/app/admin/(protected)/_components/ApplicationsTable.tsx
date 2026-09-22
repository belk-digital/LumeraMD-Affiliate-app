import ApplicationRow, { type ApplicationListItem } from "./ApplicationRow";

export default function ApplicationsTable({
  applications,
  emptyMessage,
}: {
  applications: ApplicationListItem[];
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
            <ApplicationRow key={a.id} application={a} />
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
