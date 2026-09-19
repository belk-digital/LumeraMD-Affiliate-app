export const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function Card({
  title,
  children,
  delay = 0,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <section
      className={`animate-fade-up rounded-2xl border border-line bg-white p-5 shadow-sm ${className}`}
      style={{ "--delay": `${delay}ms` } as React.CSSProperties}
    >
      <h2 className="mb-4 font-heading text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function Table({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-page-bg text-left text-xs font-medium text-ink/60">
            {headers.map((h, i) => (
              <th
                key={h}
                className={`px-3 py-3 ${i === 0 ? "rounded-l-xl" : ""} ${
                  i === headers.length - 1 ? "rounded-r-xl" : ""
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="whitespace-nowrap px-3 py-3 text-ink/70">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="py-10 text-center text-ink/40">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
