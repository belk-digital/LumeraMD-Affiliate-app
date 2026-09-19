const STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  paid: "bg-indigo-50 text-indigo-700",
  rejected: "bg-rose-50 text-rose-600",
  reversed: "bg-rose-50 text-rose-600",
  voided: "bg-slate-100 text-slate-500",
  suspended: "bg-slate-100 text-slate-600",
};

export default function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
        STYLES[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}
