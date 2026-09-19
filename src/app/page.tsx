import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import Icon, { type IconName } from "@/components/Icon";
import { getAffiliateSession } from "@/lib/affiliates/session";

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "cursor",
    title: "Your own link, code & QR",
    body: "Every approved affiliate gets a personal referral link, a unique discount code and a downloadable QR code.",
  },
  {
    icon: "chart",
    title: "Live tracking",
    body: "Watch clicks, orders and commissions update in your dashboard, with a notification the moment you earn.",
  },
  {
    icon: "card",
    title: "Simple payouts",
    body: "Request a payout whenever your approved balance reaches the minimum, via Zelle, Cash App or PayPal.",
  },
];

const STEPS = [
  { n: "1", title: "Apply", body: "Tell us a little about you. We review every application." },
  { n: "2", title: "Share", body: "Once approved, share your link, code or QR with your audience." },
  { n: "3", title: "Earn", body: "Get credited for every order, then request your payout." },
];

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as React.CSSProperties;

export default async function Home() {
  const session = await getAffiliateSession();
  const dashboardHref = session ? `/affiliates/dashboard/${session.affiliateId}` : null;

  return (
    <div className="flex min-h-screen flex-col bg-page-bg">
      <div className="relative overflow-hidden bg-primary text-white">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10" />
        <div className="animate-float-slow pointer-events-none absolute -bottom-24 -left-20 h-80 w-80 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute right-1/4 top-1/2 h-24 w-24 rounded-full bg-white/10" />
      <header className="relative">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" aria-label="LumeraMD home" className="block">
            <BrandLogo variant="white" className="-my-3 -ml-3 h-24 w-24" />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            {dashboardHref ? (
              <Link
                href={dashboardHref}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-primary transition hover:bg-white/90"
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 hover:text-white"
                >
                  Log in
                </Link>
                <Link
                  href="/affiliates/apply"
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-primary transition hover:bg-white/90"
                >
                  Apply now
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

        <section className="pb-28 pt-12 sm:pb-32 sm:pt-16">

          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
            <p
              className="animate-fade-up mb-5 inline-block rounded-full bg-white/15 px-4 py-1.5 text-xs font-medium"
              style={delay(0)}
            >
              LumeraMD Affiliate Program
            </p>
            <h1
              className="animate-fade-up font-heading text-4xl font-semibold leading-tight sm:text-6xl"
              style={delay(80)}
            >
              Earn commission on every order you refer
            </h1>
            <p
              className="animate-fade-up mx-auto mt-6 max-w-xl text-base text-white/75 sm:text-lg"
              style={delay(160)}
            >
              Share your personal link or discount code, and get rewarded when your audience shops
              with LumeraMD. Apply in minutes — we review every application.
            </p>
            <div
              className="animate-fade-up mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
              style={delay(240)}
            >
              {dashboardHref ? (
                <Link
                  href={dashboardHref}
                  className="w-full rounded-xl bg-white px-7 py-3 text-sm font-semibold text-primary shadow-lg transition hover:bg-white/90 sm:w-auto"
                >
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/affiliates/apply"
                    className="w-full rounded-xl bg-white px-7 py-3 text-sm font-semibold text-primary shadow-lg transition hover:bg-white/90 sm:w-auto"
                  >
                    Apply now
                  </Link>
                  <Link
                    href="/login"
                    className="w-full rounded-xl border border-white/40 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
                  >
                    Log in
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      <main className="flex-1">
        <section className="relative -mt-16 px-4 sm:px-6">
          <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="animate-fade-up rounded-2xl border border-line bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                style={delay(320 + i * 90)}
              >
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
                  <Icon name={f.icon} className="h-5 w-5" />
                </span>
                <h2 className="font-heading text-base font-semibold text-ink">{f.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink/60">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
          <h2 className="text-center font-heading text-2xl font-semibold text-ink sm:text-3xl">
            How it works
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary font-heading text-lg font-semibold text-white">
                  {s.n}
                </span>
                <h3 className="mt-4 font-heading text-base font-semibold text-ink">{s.title}</h3>
                <p className="mx-auto mt-1 max-w-xs text-sm text-ink/60">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {!dashboardHref && (
          <section className="px-4 pb-20 sm:px-6">
            <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl bg-primary px-6 py-12 text-center text-white sm:px-12">
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-white/10" />
              <h2 className="relative font-heading text-2xl font-semibold sm:text-3xl">
                Ready to start earning?
              </h2>
              <p className="relative mx-auto mt-3 max-w-md text-white/75">
                It takes about a minute to apply.
              </p>
              <Link
                href="/affiliates/apply"
                className="relative mt-7 inline-block rounded-xl bg-white px-7 py-3 text-sm font-semibold text-primary shadow-lg transition hover:bg-white/90"
              >
                Apply now
              </Link>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 text-xs text-ink/40 sm:px-6">
          <span>© {new Date().getFullYear()} LumeraMD</span>
          <Link href="/admin/login" className="transition hover:text-ink/70">
            Admin
          </Link>
        </div>
      </footer>
    </div>
  );
}
