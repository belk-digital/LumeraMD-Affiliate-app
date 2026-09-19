"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/Icon";

const OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

/** Only shown on the page it controls, since other pages aren't date-scoped. */
export default function RangeSelect({ basePath }: { basePath: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();

  if (pathname !== basePath) return null;

  const current = OPTIONS.some((o) => o.value === params.get("range"))
    ? (params.get("range") as string)
    : "30";

  return (
    <label className="relative shrink-0">
      <Icon
        name="calendar"
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50 sm:left-3.5 sm:h-4.5 sm:w-4.5"
      />
      <select
        value={current}
        onChange={(e) => router.replace(`${basePath}?range=${e.target.value}`)}
        aria-label="Date range"
        className="appearance-none rounded-xl border border-line bg-white py-2.5 pl-8 pr-7 text-xs text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 sm:pl-10 sm:pr-10 sm:text-sm"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevronDown"
        className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40 sm:right-3.5 sm:h-4 sm:w-4"
      />
    </label>
  );
}
