"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";

export default function ApplicationActions({
  id,
  status,
  linkedAffiliateId,
}: {
  id: string;
  status: string;
  linkedAffiliateId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setMenuOpen(false);
    try {
      const res = await fetch(`/api/admin/applications/${id}/${action}`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? `Could not ${action} this application.`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (status === "pending") {
    return (
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => act("approve")}
          disabled={busy}
          className="rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
        >
          {busy ? "Working…" : "Approve"}
        </button>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="More actions"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink/50 hover:bg-page-bg"
          >
            <Icon name="dots" className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-xl border border-line bg-white p-1 shadow-lg">
              <button
                onClick={() => {
                  if (confirm("Reject this application?")) act("reject");
                  else setMenuOpen(false);
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === "approved" && linkedAffiliateId) {
    return (
      <div className="flex justify-end">
        <Link
          href={`/admin/affiliates/${linkedAffiliateId}`}
          className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-ink/70 transition hover:bg-page-bg"
        >
          View
        </Link>
      </div>
    );
  }

  return <div className="text-right text-ink/30">—</div>;
}
