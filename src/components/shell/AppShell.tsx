"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon";
import BrandLogo from "@/components/BrandLogo";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  isActive: (path: string) => boolean;
  /** Count of items needing attention on this tab (e.g. pending applications/payouts). Omit or
   *  pass 0 to show no badge. */
  badge?: number;
}

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-error px-1.5 text-[11px] font-semibold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SideLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = item.isActive(pathname);
  return (
    <Link
      href={item.href}
      className={`relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
        active
          ? "bg-white/15 font-medium text-white before:absolute before:bottom-2 before:left-0 before:top-2 before:w-1 before:rounded-r-full before:bg-white"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon name={item.icon} className="h-5 w-5" />
      {item.label}
      <NavBadge count={item.badge ?? 0} />
    </Link>
  );
}

/** Violet sidebar + white top bar frame shared by the admin panel and the affiliate dashboard. */
export default function AppShell({
  mainNav,
  bottomNav,
  sidebarFooter,
  topBar,
  logoHref = "/",
  children,
}: {
  mainNav: NavItem[];
  bottomNav: NavItem[];
  sidebarFooter: React.ReactNode;
  topBar: React.ReactNode;
  logoHref?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-page-bg">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-primary px-3 py-5 md:flex">
        <Link href={logoHref} className="mb-5 block px-3" aria-label="LumeraMD home">
          <BrandLogo variant="white" className="-mx-3 -mt-3 -mb-4 h-28 w-28" />
          <div className="text-sm text-white/70">Affiliate Program</div>
        </Link>

        <nav className="flex-1 space-y-1">
          {mainNav.map((item) => (
            <SideLink key={item.label} item={item} pathname={pathname} />
          ))}
        </nav>

        <div className="space-y-1 border-t border-white/15 pt-4">
          {bottomNav.map((item) => (
            <SideLink key={item.label} item={item} pathname={pathname} />
          ))}
        </div>
        <div className="mt-4 border-t border-white/15 pt-4">{sidebarFooter}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/90 px-4 py-3 backdrop-blur md:px-6">
          {topBar}
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-line bg-white px-3 py-2 md:hidden">
          {[...mainNav, ...bottomNav].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${
                item.isActive(pathname)
                  ? "bg-primary-light font-medium text-primary"
                  : "text-ink/60"
              }`}
            >
              {item.label}
              {!!item.badge && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold text-white">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
