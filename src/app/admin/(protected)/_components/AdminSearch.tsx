"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/Icon";

export default function AdminSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/admin/affiliates?q=${encodeURIComponent(q)}` : "/admin/affiliates");
  }

  return (
    <form onSubmit={submit} className="relative min-w-0 flex-1 max-w-xl">
      <Icon
        name="search"
        className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink/40"
      />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search affiliates, emails, or reference IDs…"
        aria-label="Search affiliates"
        className="w-full rounded-full border border-line bg-page-bg py-2.5 pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-ink/40 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
      />
    </form>
  );
}
