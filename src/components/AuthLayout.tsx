import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import Icon, { type IconName } from "@/components/Icon";

interface Point {
  icon: IconName;
  title: string;
  body: string;
}

const DEFAULT_POINTS: Point[] = [
  {
    icon: "cursor",
    title: "Your own link, code & QR",
    body: "Everything you need to share LumeraMD, ready on day one.",
  },
  {
    icon: "chart",
    title: "Live tracking",
    body: "Clicks, orders and commissions update as they happen.",
  },
  {
    icon: "card",
    title: "Simple payouts",
    body: "Request a payout whenever you reach the minimum.",
  },
];

/** Split layout used by login and apply: violet brand panel beside the form. */
export default function AuthLayout({
  headline,
  blurb,
  points = DEFAULT_POINTS,
  title,
  subtitle,
  children,
}: {
  headline: string;
  blurb: string;
  points?: Point[];
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-page-bg md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-white md:flex lg:p-14">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="animate-float-slow pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute bottom-40 right-10 h-24 w-24 rounded-full bg-white/10" />

        <Link href="/" className="relative block w-fit" aria-label="LumeraMD home">
          <BrandLogo variant="white" className="-mx-3 -mt-3 -mb-4 h-28 w-28" />
          <div className="text-sm text-white/70">Affiliate Program</div>
        </Link>

        <div className="relative max-w-md">
          <h2 className="font-heading text-3xl font-semibold leading-tight lg:text-4xl">
            {headline}
          </h2>
          <p className="mt-4 text-base text-white/75">{blurb}</p>
          <ul className="mt-8 space-y-5">
            {points.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Icon name={p.icon} className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-medium">{p.title}</span>
                  <span className="block text-sm text-white/70">{p.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-white/50">
          © {new Date().getFullYear()} LumeraMD
        </div>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="animate-fade-up w-full max-w-md">
          <Link href="/" className="mb-6 block w-fit md:hidden" aria-label="LumeraMD home">
            <BrandLogo className="-mx-2 -my-3 h-24 w-24" />
          </Link>
          <h1 className="font-heading text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
          {subtitle && <p className="mb-6 mt-2 text-sm text-ink/60">{subtitle}</p>}
          {!subtitle && <div className="mb-6" />}
          {children}
        </div>
      </main>
    </div>
  );
}
