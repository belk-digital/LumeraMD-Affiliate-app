"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export interface Sample {
  label: string;
  code: string;
}

/** A code sample with optional language tabs and a copy button. */
export default function CodeBlock({ samples }: { samples: Sample[] }) {
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const active = samples[Math.min(index, samples.length - 1)];

  async function copy() {
    try {
      await navigator.clipboard.writeText(active.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the text is still selectable.
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[#0f1b2a] text-slate-100">
      <div className="flex items-center justify-between border-b border-white/10 px-3">
        <div className="flex gap-1">
          {samples.map((s, i) => (
            <button
              key={s.label}
              onClick={() => setIndex(i)}
              className={`border-b-2 px-3 py-2.5 text-xs font-medium transition ${
                i === index ? "border-sky-400 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={copy}
          aria-label="Copy code"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code>{active.code}</code>
      </pre>
    </div>
  );
}
