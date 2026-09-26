"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import type { AttentionItem } from "./useAdminAttention";

function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Shows what needs an admin's attention right now (pending applications and payout requests).
 *  Fed by AdminShell (see useAdminAttention) so this shares the same poll as the sidebar badges
 *  instead of fetching a second time. */
export default function AdminBell({ items, total }: { items: AttentionItem[]; total: number }) {
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${total ? `, ${total} need attention` : ""}`}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink/60 transition hover:bg-page-bg"
      >
        <Icon name="bell" className="h-5 w-5" />
        {total > 0 && (
          <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-error" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
          <div className="border-b border-line px-4 py-3">
            <span className="font-heading text-sm font-semibold text-ink">Needs attention</span>
            <span className="ml-2 text-xs text-ink/50">{total} pending</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-ink/40">
                Nothing waiting on you.
              </div>
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-line px-4 py-3 last:border-0 hover:bg-page-bg"
                >
                  <span className="block text-sm font-medium text-ink">{item.title}</span>
                  <span className="block text-xs text-ink/50">{item.subtitle}</span>
                  <span className="mt-1 block text-[11px] text-ink/40">
                    {timeAgo(item.createdAt)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
