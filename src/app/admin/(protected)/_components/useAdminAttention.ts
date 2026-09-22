"use client";

import { useCallback, useEffect, useState } from "react";

export interface AttentionItem {
  id: string;
  title: string;
  subtitle: string;
  createdAt: string;
  href: string;
}

interface AttentionState {
  pendingApplications: number;
  pendingPayouts: number;
  items: AttentionItem[];
}

const POLL_INTERVAL_MS = 20_000;
const EMPTY: AttentionState = { pendingApplications: 0, pendingPayouts: 0, items: [] };

/** Single source of truth for "needs an admin's attention right now" — polled once here and fed
 *  to both the sidebar nav badges (AdminShell) and the notification bell (AdminBell), so they
 *  never show different counts and we don't double the network calls. */
export function useAdminAttention() {
  const [state, setState] = useState<AttentionState>(EMPTY);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/attention", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setState({
        pendingApplications: data.pendingApplications ?? 0,
        pendingPayouts: data.pendingPayouts ?? 0,
        items: data.items ?? [],
      });
    } catch {
      // next poll retries
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  return state;
}
