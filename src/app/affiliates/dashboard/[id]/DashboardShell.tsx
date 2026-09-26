"use client";

import { Suspense, useState } from "react";
import AppShell, { type NavItem } from "@/components/shell/AppShell";
import UserMenu from "@/components/shell/UserMenu";
import RangeSelect from "@/components/RangeSelect";
import Icon from "@/components/Icon";
import ShareButton from "./ShareButton";
import NotificationBell from "./NotificationBell";

export default function DashboardShell({
  affiliateId,
  affiliateEmail,
  displayName,
  referralLink,
  discountCode = null,
  children,
}: {
  affiliateId: string;
  affiliateEmail?: string;
  displayName?: string | null;
  referralLink: string;
  discountCode?: string | null;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const base = `/affiliates/dashboard/${affiliateId}`;
  const mainNav: NavItem[] = [
    { href: base, label: "Overview", icon: "clipboard", isActive: (p) => p === base },
    {
      href: `${base}/conversions`,
      label: "Conversions",
      icon: "chart",
      isActive: (p) => p.startsWith(`${base}/conversions`),
    },
    {
      href: `${base}/payouts`,
      label: "Payouts",
      icon: "card",
      isActive: (p) => p.startsWith(`${base}/payouts`),
    },
    {
      href: `${base}/team`,
      label: "Team",
      icon: "users",
      isActive: (p) => p.startsWith(`${base}/team`),
    },
  ];
  const bottomNav: NavItem[] = [
    {
      href: `${base}/settings`,
      label: "Settings",
      icon: "settings",
      isActive: (p) => p.startsWith(`${base}/settings`),
    },
  ];

  const name = displayName || affiliateEmail || "Affiliate";
  const menu = (variant: "topbar" | "sidebar") => (
    <UserMenu
      name={name}
      role="Affiliate"
      email={affiliateEmail ?? ""}
      variant={variant}
      items={[{ label: "Settings", href: `${base}/settings` }]}
      logoutEndpoint="/api/affiliates/auth/logout"
      logoutRedirect="/"
    />
  );

  return (
    <AppShell
      mainNav={mainNav}
      bottomNav={bottomNav}
      logoHref="/"
      sidebarFooter={menu("sidebar")}
      topBar={
        <>
          <div className="flex min-w-0 flex-1 max-w-xl items-center gap-2 rounded-full border border-line bg-page-bg px-4 py-2.5 text-sm text-ink/60">
            <Icon name="link" className="h-4 w-4 shrink-0 text-ink/40" />
            <span className="truncate">{referralLink}</span>
          </div>
          <button
            onClick={copyLink}
            title="Copy link"
            aria-label="Copy order link"
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-ink/50 transition hover:bg-page-bg sm:flex"
          >
            {copied ? (
              <svg
                className="h-4 w-4 text-[#3f8a54]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          <ShareButton
            affiliateId={affiliateId}
            referralLink={referralLink}
            discountCode={discountCode}
          />
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
            <Suspense fallback={null}>
              <RangeSelect basePath={base} />
            </Suspense>
            <NotificationBell affiliateId={affiliateId} />
            {menu("topbar")}
          </div>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
