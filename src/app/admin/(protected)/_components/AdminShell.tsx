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
      href: "/admin",
      label: "Overview",
      icon: "pie",
      isActive: (p) => p === "/admin",
    },
    {
      href: "/admin/applications",
      label: "Applications",
      icon: "clipboard",
      isActive: (p) => p.startsWith("/admin/applications"),
      badge: pendingApplications,
    },
    {
      href: "/admin/affiliates",
      label: "All Affiliates",
      icon: "users",
      isActive: (p) => p.startsWith("/admin/affiliates"),
    },
    {
      href: "/admin/conversions",
      label: "Conversions",
      icon: "chart",
      isActive: (p) => p.startsWith("/admin/conversions"),
    },
    {
      href: "/admin/payouts",
      label: "Payouts",
      icon: "card",
      isActive: (p) => p.startsWith("/admin/payouts"),
      badge: pendingPayouts,
    },
    {
      href: "/admin/clicks",
      label: "Clicks",
      icon: "cursor",
      isActive: (p) => p.startsWith("/admin/clicks"),
    },
    {
      href: "/admin/reports",
      label: "Reports",
      icon: "chart",
      isActive: (p) => p.startsWith("/admin/reports"),
    },
  ];
}

const BOTTOM_NAV: NavItem[] = [
  {
    href: "/admin/settings",
    label: "Settings",
    icon: "settings",
    isActive: (p) => p.startsWith("/admin/settings"),
  },
  {
    href: "/admin/help",
    label: "Help",
    icon: "help",
    isActive: (p) => p.startsWith("/admin/help"),
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
      logoutEndpoint="/api/admin/auth/logout"
      logoutRedirect="/admin/login"
    />
  );

  return (
    <AppShell
      mainNav={mainNav}
      bottomNav={BOTTOM_NAV}
      logoHref="/admin"
      sidebarFooter={menu("sidebar")}
      topBar={
        <>
          <AdminSearch />
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
            <Suspense fallback={null}>
              <RangeSelect basePath="/admin" />
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
