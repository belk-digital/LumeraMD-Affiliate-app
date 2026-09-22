"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";

export default function ApplicationActions({
  id,
  status,
  linkedAffiliateId,
  w9FileName,
  w9VerifiedAt,
  onReview,
}: {
  id: string;
  status: string;
  linkedAffiliateId: string | null;
  w9FileName?: string | null;
  w9VerifiedAt?: Date | null;
  onReview?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // A submitted W-9 must be opened and verified by an admin before the application can be
  // approved — see the review modal (onReview) and /api/admin/applications/[id]/verify-w9.
  const w9Blocking = !!w9FileName && !w9VerifiedAt;

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
        {onReview && (
          <button
            onClick={onReview}
            className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-ink/70 transition hover:bg-page-bg"
          >
            Review
          </button>
        )}
        <button
          onClick={() => act("approve")}
          disabled={busy || w9Blocking}
          title={w9Blocking ? "Verify the W-9 before approving (see Review)" : undefined}
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
