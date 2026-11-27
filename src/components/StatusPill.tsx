const STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  paid: "bg-sky-50 text-sky-700",
  rejected: "bg-rose-50 text-rose-600",
  reversed: "bg-rose-50 text-rose-600",
  voided: "bg-slate-100 text-slate-500",
  suspended: "bg-slate-100 text-slate-600",
  active: "bg-emerald-50 text-emerald-700",
  pending_payment: "bg-amber-50 text-amber-700",
  past_due: "bg-rose-50 text-rose-600",
  cancelled: "bg-slate-100 text-slate-500",
  paused: "bg-amber-50 text-amber-700",
  sent: "bg-emerald-50 text-emerald-700",
  failed: "bg-rose-50 text-rose-600",
  logged: "bg-slate-100 text-slate-600",
};

export default function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
        STYLES[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
