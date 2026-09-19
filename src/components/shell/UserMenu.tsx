"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { initials } from "@/components/Avatar";

export interface UserMenuItem {
  label: string;
  href: string;
}

export default function UserMenu({
  name,
  role,
  email,
  variant,
  items = [],
  logoutEndpoint,
  logoutRedirect,
}: {
  name: string;
  role: string;
  email: string;
  variant: "topbar" | "sidebar";
  items?: UserMenuItem[];
  logoutEndpoint: string;
  logoutRedirect: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    await fetch(logoutEndpoint, { method: "POST" });
    router.push(logoutRedirect);
    router.refresh();
  }

  const sidebar = variant === "sidebar";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Account menu"
        className={`flex w-full items-center gap-3 rounded-xl text-left transition ${
          sidebar ? "px-2 py-2 hover:bg-white/10" : "px-2 py-1.5 hover:bg-page-bg"
        }`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            sidebar ? "bg-white text-primary" : "bg-primary text-white"
          }`}
        >
          {initials(name)}
        </span>
        <span className={`min-w-0 flex-1 ${sidebar ? "" : "hidden lg:block"}`}>
          <span
            className={`block truncate text-sm font-semibold ${sidebar ? "text-white" : "text-ink"}`}
          >
            {name}
          </span>
          <span className={`block truncate text-xs ${sidebar ? "text-white/70" : "text-ink/50"}`}>
            {sidebar ? email : role}
          </span>
        </span>
        <Icon
          name="chevronDown"
          className={`h-4 w-4 shrink-0 ${sidebar ? "text-white/60" : "text-ink/40"}`}
        />
      </button>

      {open && (
        <div
          className={`absolute z-40 w-60 overflow-hidden rounded-2xl border border-line bg-white shadow-lg ${
            sidebar ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2"
          }`}
        >
          <div className="border-b border-line px-4 py-3">
            <div className="truncate text-sm font-medium text-ink">{name}</div>
            <div className="truncate text-xs text-ink/50">{email}</div>
          </div>
          <div className="p-1.5">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm text-ink/70 hover:bg-page-bg"
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={logout}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink/70 hover:bg-page-bg"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
