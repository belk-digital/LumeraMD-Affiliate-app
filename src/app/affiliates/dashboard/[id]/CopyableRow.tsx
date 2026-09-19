"use client";

import { useState } from "react";

export default function CopyableRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
      <span className="text-ink/50 sm:w-32 shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <code
          className={`break-all rounded-md bg-page-bg px-2 py-1 text-xs ${mono ? "font-mono" : ""}`}
        >
          {value}
        </code>
        <button
          onClick={copy}
          className="shrink-0 rounded-md border border-line px-2 py-1 text-xs text-ink/60 hover:bg-page-bg"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
