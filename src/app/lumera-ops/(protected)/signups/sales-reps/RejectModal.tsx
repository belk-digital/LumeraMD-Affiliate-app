"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { Backdrop } from "../_components/kit";
import type { RepData } from "./types";

export default function RejectModal({
  rep,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  rep: RepData;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  return (
    <Backdrop onClose={() => !busy && onCancel()}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error">
            <Icon name="clipboard" className="h-6 w-6" />
          </div>
          <h3 className="mb-2 text-center font-heading text-lg font-bold text-ink">Reject this application?</h3>
          <p className="mb-4 text-center text-sm font-medium text-ink/70">
            <strong className="text-ink">{rep.name}</strong> won&apos;t get an affiliate account. You can still approve
            them later.
          </p>
          <label className="mb-1.5 block text-xs font-medium text-ink/50">
            Note <span className="font-normal text-ink/40">(optional, internal only)</span>
          </label>
          <textarea
            rows={2}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mb-4 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          {error && <p className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={busy}
              className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-ink/70 transition hover:bg-page-bg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(notes.trim())}
              disabled={busy}
              className="flex-1 rounded-xl bg-error py-2.5 text-sm font-medium text-white transition hover:bg-error/90 disabled:opacity-50"
            >
              {busy ? "Rejecting…" : "Reject"}
            </button>
          </div>
        </div>
      </div>
    </Backdrop>
  );
}
