"use client";

import { Suspense } from "react";
import AppShell, { type NavItem } from "@/components/shell/AppShell";
import UserMenu from "@/components/shell/UserMenu";
import RangeSelect from "@/components/RangeSelect";
import AdminSearch from "./AdminSearch";
import AdminBell from "./AdminBell";

const MAIN_NAV: NavItem[] = [
  {
    href: "/admin",
    label: "Applications",
    icon: "clipboard",
    isActive: (p) => p === "/admin" || p.startsWith("/admin/applications"),
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
  },
  {
    href: "/admin/clicks",
    label: "Clicks",
    icon: "cursor",
    isActive: (p) => p.startsWith("/admin/clicks"),
  },
];

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
      mainNav={MAIN_NAV}
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
            <AdminBell />
            {menu("topbar")}
          </div>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
