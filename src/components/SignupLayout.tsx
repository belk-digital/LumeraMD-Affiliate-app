import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import Icon, { type IconName } from "@/components/Icon";

interface Point {
  icon: IconName;
  title: string;
  body: string;
}

/**
 * Layout for the public signup pages: soft blue backdrop, brand copy on the left, and the form in
 * a white card on the right. (Login pages keep the solid AuthLayout.)
 */
export default function SignupLayout({
  headline,
  accent,
  blurb,
  points,
  title,
  subtitle,
  children,
}: {
  headline: string;
  /** The last words of the headline, shown in the brand color. */
  accent: string;
  blurb: string;
  points: Point[];
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,#e8f0f8_0%,#f4f8fc_45%,#dfe9f4_100%)]">
      <div className="mx-auto grid min-h-screen max-w-[1400px] gap-8 px-4 py-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12 lg:px-8 lg:py-9">
        <aside className="hidden flex-col justify-between lg:flex">
          <div>
            <Link href="/" className="flex w-fit items-center gap-4" aria-label="LumeraMD home">
              <BrandLogo className="-my-6 -ml-3 h-24 w-24" />
              <span className="h-6 w-px bg-ink/15" />
              <span className="text-sm text-ink/60">Affiliate Program</span>
            </Link>

            <h2 className="mt-10 font-heading text-5xl font-bold leading-[1.05] tracking-tight text-ink xl:text-6xl">
              {headline} <span className="text-primary">{accent}</span>
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink/60">{blurb}</p>

            <ul className="mt-9 space-y-6">
              {points.map((p) => (
                <li key={p.title} className="flex items-center gap-5">
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/70 text-primary shadow-sm ring-1 ring-primary/10">
                    <Icon name={p.icon} className="h-7 w-7" />
                  </span>
                  <span className="max-w-xs">
                    <span className="block font-heading text-lg font-semibold text-ink">{p.title}</span>
                    <span className="block text-sm leading-relaxed text-ink/60">{p.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="pt-10 text-xs text-ink/45">© {new Date().getFullYear()} LumeraMD</div>
        </aside>

        <main className="flex items-center justify-center">
          <div className="animate-fade-up w-full max-w-3xl rounded-3xl bg-white p-6 shadow-[0_20px_60px_-20px_rgba(23,50,78,0.25)] sm:p-9">
            <Link href="/" className="mb-3 block w-fit lg:hidden" aria-label="LumeraMD home">
              <BrandLogo className="-mx-2 -my-3 h-20 w-20" />
            </Link>
            <h1 className="font-heading text-3xl font-bold text-ink">{title}</h1>
            <p className="mb-6 mt-1.5 text-sm text-ink/60">{subtitle}</p>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
