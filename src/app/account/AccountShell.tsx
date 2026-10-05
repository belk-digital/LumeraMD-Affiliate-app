"use client";

import AppShell, { type NavItem } from "@/components/shell/AppShell";
import UserMenu from "@/components/shell/UserMenu";
import { LogoutButton } from "./AccountClient";

const BASE = "/account";

const mainNav: NavItem[] = [
  { href: BASE, label: "Overview", icon: "pie", isActive: (p) => p === BASE },
  { href: `${BASE}/orders`, label: "Orders", icon: "bag", isActive: (p) => p.startsWith(`${BASE}/orders`) },
  { href: `${BASE}/membership`, label: "Membership", icon: "card", isActive: (p) => p.startsWith(`${BASE}/membership`) },
  { href: `${BASE}/wallet`, label: "Wallet", icon: "wallet", isActive: (p) => p.startsWith(`${BASE}/wallet`) },
  { href: `${BASE}/consultations`, label: "Consultations", icon: "calendar", isActive: (p) => p.startsWith(`${BASE}/consultations`) },
  { href: `${BASE}/test-kit`, label: "DNA Test Kit", icon: "flask", isActive: (p) => p.startsWith(`${BASE}/test-kit`) },
];

const bottomNav: NavItem[] = [
  { href: `${BASE}/settings`, label: "Account Settings", icon: "settings", isActive: (p) => p.startsWith(`${BASE}/settings`) },
];

/** The member dashboard frame: sidebar, top bar with the user menu, and a tab strip on phones. */
export default function AccountShell({
  name,
  email,
  children,
}: {
  name: string;
  email: string;
  children: React.ReactNode;
}) {
  const menu = (variant: "topbar" | "sidebar") => (
    <UserMenu
      name={name}
      role="Member"
      email={email}
      variant={variant}
      items={[{ label: "Account settings", href: `${BASE}/settings` }]}
      logoutEndpoint="/api/customers/auth/logout"
      logoutRedirect="/account/login"
    />
  );

  return (
    <AppShell
      mainNav={mainNav}
      bottomNav={bottomNav}
      brandLabel="Member Account"
      logoHref={BASE}
      sidebarFooter={menu("sidebar")}
      topBar={
        <>
          <div className="flex-1 text-sm text-ink/45">Your LumeraMD membership</div>
          {menu("topbar")}
          <div className="hidden sm:block">
            <LogoutButton />
          </div>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
