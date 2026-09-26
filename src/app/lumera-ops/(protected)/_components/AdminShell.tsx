"use client";

import { Suspense } from "react";
import AppShell, { type NavItem } from "@/components/shell/AppShell";
import UserMenu from "@/components/shell/UserMenu";
import RangeSelect from "@/components/RangeSelect";
import AdminSearch from "./AdminSearch";
import AdminBell from "./AdminBell";
import { useAdminAttention } from "./useAdminAttention";

/** Nav badges only make sense on tabs with a genuine "someone else needs a decision from you"
 *  queue — pending applications and payout requests. Tabs without such a queue (Overview,
 *  Affiliates, Conversions, Clicks, Reports) intentionally get none. */
function buildMainNav({
  pendingApplications,
  pendingPayouts,
}: {
  pendingApplications: number;
  pendingPayouts: number;
}): NavItem[] {
  return [
    {
      href: "/lumera-ops",
      label: "Overview",
      icon: "pie",
      isActive: (p) => p === "/lumera-ops",
    },
    {
      href: "/lumera-ops/applications",
      label: "Applications",
      icon: "clipboard",
      isActive: (p) => p.startsWith("/lumera-ops/applications"),
      badge: pendingApplications,
    },
    {
      href: "/lumera-ops/affiliates",
      label: "All Affiliates",
      icon: "users",
      isActive: (p) => p.startsWith("/lumera-ops/affiliates"),
    },
    {
      href: "/lumera-ops/conversions",
      label: "Conversions",
      icon: "chart",
      isActive: (p) => p.startsWith("/lumera-ops/conversions"),
    },
    {
      href: "/lumera-ops/payouts",
      label: "Payouts",
      icon: "card",
      isActive: (p) => p.startsWith("/lumera-ops/payouts"),
      badge: pendingPayouts,
    },
    {
      href: "/lumera-ops/clicks",
      label: "Clicks",
      icon: "cursor",
      isActive: (p) => p.startsWith("/lumera-ops/clicks"),
    },
    {
      href: "/lumera-ops/reports",
      label: "Reports",
      icon: "chart",
      isActive: (p) => p.startsWith("/lumera-ops/reports"),
    },
  ];
}

const BOTTOM_NAV: NavItem[] = [
  {
    href: "/lumera-ops/settings",
    label: "Settings",
    icon: "settings",
    isActive: (p) => p.startsWith("/lumera-ops/settings"),
  },
  {
    href: "/lumera-ops/help",
    label: "Help",
    icon: "help",
    isActive: (p) => p.startsWith("/lumera-ops/help"),
  },
];

export default function AdminShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const { pendingApplications, pendingPayouts, items } = useAdminAttention();
  const mainNav = buildMainNav({ pendingApplications, pendingPayouts });

  const menu = (variant: "topbar" | "sidebar") => (
    <UserMenu
      name="Super Admin"
      role="Administrator"
      email={email}
      variant={variant}
      logoutEndpoint="/api/lumera-ops/auth/logout"
      logoutRedirect="/lumera-ops/login"
    />
  );

  return (
    <AppShell
      mainNav={mainNav}
      bottomNav={BOTTOM_NAV}
      logoHref="/lumera-ops"
      sidebarFooter={menu("sidebar")}
      topBar={
        <>
          <AdminSearch />
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
            <Suspense fallback={null}>
              <RangeSelect basePath="/lumera-ops" />
            </Suspense>
            <AdminBell items={items} total={pendingApplications + pendingPayouts} />
            {menu("topbar")}
          </div>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
