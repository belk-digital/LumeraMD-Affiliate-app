"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

function CopyIcon({ done }: { done: boolean }) {
  return done ? (
    <svg
      className="h-4 w-4 text-[#3f8a54]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  ) : (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

const svgProps = { className: "h-5 w-5", viewBox: "0 0 24 24", "aria-hidden": true } as const;

const ICONS = {
  x: (
    <svg {...svgProps} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  mail: (
    <svg
      {...svgProps}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 7.5l8.5 6 8.5-6" />
    </svg>
  ),
  reddit: (
    <svg {...svgProps} fill="currentColor">
      <ellipse cx="12" cy="14.2" rx="7.6" ry="5.3" />
      <circle cx="4.7" cy="11.6" r="1.7" />
      <circle cx="19.3" cy="11.6" r="1.7" />
      <circle cx="17.7" cy="5.2" r="1.35" />
      <path
        d="M12 9V5.2l4.3.9"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.3" cy="13.4" r="1.15" fill="#ff4500" />
      <circle cx="14.7" cy="13.4" r="1.15" fill="#ff4500" />
      <path
        d="M9.2 16.6c1.7 1.2 3.9 1.2 5.6 0"
        fill="none"
        stroke="#ff4500"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </svg>
  ),
  telegram: (
    <svg {...svgProps} fill="currentColor">
      <path d="M21.4 3.9 2.9 11.1c-.9.4-.9 1 0 1.3l4.7 1.5 1.8 5.5c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.2-2.1 4.5 3.3c.8.5 1.5.2 1.7-.8l3-14.3c.3-1.2-.4-1.8-1.3-1.4z" />
      <path
        d="M8.2 13.6l9.6-6"
        fill="none"
        stroke="#229ed9"
        strokeWidth={1.1}
        strokeLinecap="round"
      />
    </svg>
  ),
  message: (
    <svg
      {...svgProps}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 11.5a8.4 8.4 0 01-12.2 7.5L3.5 20.5l1.6-4.7A8.4 8.4 0 1121 11.5z" />
    </svg>
  ),
  more: (
    <svg
      {...svgProps}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 3.9M15.4 6.6L8.6 10.5" />
    </svg>
  ),
};

function CopyField({
  value,
  label,
  onCopy,
  copied,
  mono,
  trailing,
}: {
  value: string;
  label: string;
  onCopy: () => void;
  copied: boolean;
  mono?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={value}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        className={`h-11 min-w-0 flex-1 truncate rounded-xl border border-line bg-page-bg px-3.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 ${
          mono ? "font-mono tracking-wide" : ""
        }`}
      />
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${label.toLowerCase()}`}
        title={`Copy ${label.toLowerCase()}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-ink/60 transition hover:bg-page-bg"
      >
        <CopyIcon done={copied} />
      </button>
      {trailing}
    </div>
  );
}

export function ShareDialog({
  affiliateId,
  referralLink,
  discountCode,
  onClose,
  title = "Share & earn",
  defaultMessage,
  qrType = "referral",
}: {
  affiliateId: string;
  referralLink: string;
  discountCode: string | null;
  onClose: () => void;
  title?: string;
  defaultMessage?: string;
  /** Which link the QR code encodes: the storefront order link, or the team-invite link. They
   *  must never match, or a sub-affiliate invite would hand out the order link instead. */
  qrType?: "referral" | "invite";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [canNativeShare] = useState(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
  );

  const message = defaultMessage || (discountCode
    ? `Shop LumeraMD with my link: ${referralLink}\nOr use my code ${discountCode} at checkout.`
    : `Shop LumeraMD with my link: ${referralLink}`);
  const qrUrl = `/api/affiliates/${affiliateId}/qr${qrType === "invite" ? "?type=invite" : ""}`;

  const flash = useCallback((setter: (v: string | null) => void, v: string) => {
    setter(v);
    window.setTimeout(() => setter(null), 1800);
  }, []);

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      flash(setNotice, "Couldn't copy — select the text and copy it manually.");
    }
  }

  // Keyboard: Escape closes, Tab stays inside the dialog.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  async function nativeShare() {
    try {
      // Phones can attach the QR image too; other browsers share the text and link only.
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const file = new File([blob], "lumeramd-qr.png", { type: "image/png" });
      const withFile = { text: message, files: [file] };
      if (navigator.canShare?.(withFile)) {
        await navigator.share(withFile);
      } else {
        await navigator.share({ text: message, url: referralLink });
      }
    } catch {
      // cancelled or unsupported: nothing to do
    }
  }

  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const enc = encodeURIComponent;
  const channels: {
    key: string;
    label: string;
    href?: string;
    color: string;
    icon: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    external?: boolean;
  }[] = [
    {
      key: "x",
      label: "Share on X",
      href: `https://twitter.com/intent/tweet?text=${enc(message)}`,
      color: "#0f1419",
      icon: ICONS.x,
      external: true,
    },
    {
      key: "mail",
      label: "Share by email",
      href: `mailto:?subject=${enc("Check out LumeraMD")}&body=${enc(message)}`,
      color: "#5b6478",
      icon: ICONS.mail,
    },
    {
      key: "reddit",
      label: "Share on Reddit",
      href: `https://www.reddit.com/submit?url=${enc(referralLink)}&title=${enc(
        discountCode ? `LumeraMD — use code ${discountCode}` : "LumeraMD",
      )}`,
      color: "#ff4500",
      icon: ICONS.reddit,
      external: true,
    },
    {
      key: "telegram",
      label: "Share on Telegram",
      href: `https://t.me/share/url?url=${enc(referralLink)}&text=${enc(
        discountCode ? `Use my code ${discountCode} at checkout.` : "Check out LumeraMD",
      )}`,
      color: "#229ed9",
      icon: ICONS.telegram,
      external: true,
    },
    {
      key: "message",
      label: "Share by text message",
      href: `sms:?&body=${enc(message)}`,
      color: "#34c759",
      icon: ICONS.message,
      // Desktop browsers can't open a text message, so copy it instead.
      onClick: (e) => {
        if (!isMobile) {
          e.preventDefault();
          void copy("message", message).then(() =>
            flash(setNotice, "Message copied — paste it into your messaging app."),
          );
        }
      },
    },
  ];

  const circle =
    "flex h-11 w-11 items-center justify-center rounded-full text-white transition hover:scale-105 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-ink/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        className="animate-fade-up relative w-full max-w-2xl rounded-t-3xl border border-line bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7"
      >
        <button
          type="button"
          onClick={onClose}
          data-autofocus
          aria-label="Close"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-ink/50 transition hover:bg-page-bg hover:text-ink"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <h2 id="share-dialog-title" className="font-heading text-lg font-semibold text-ink">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-ink/55">
          {title === "Share & earn" 
            ? "Anyone who orders through your link or code is credited to you."
            : "Anyone who signs up through your link will join your team."}
        </p>

        <div className="mt-5 grid gap-6 sm:grid-cols-[1fr_auto]">
          <div className="min-w-0 space-y-3">
            <CopyField
              label="Referral link"
              value={referralLink}
              copied={copiedKey === "link"}
              onCopy={() => copy("link", referralLink)}
              trailing={
                <a
                  href={referralLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open referral link in a new tab"
                  title="Open link"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-ink/60 transition hover:bg-page-bg"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.9}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 17L17 7M9 7h8v8" />
                  </svg>
                </a>
              }
            />

            {discountCode ? (
              <CopyField
                label="Discount code"
                value={discountCode}
                mono
                copied={copiedKey === "code"}
                onCopy={() => copy("code", discountCode)}
              />
            ) : (
              <p className="rounded-xl bg-page-bg px-3.5 py-3 text-sm text-ink/50">
                Your discount code isn&apos;t ready yet.
              </p>
            )}

            <div className="pt-2">
              <p className="mb-2.5 text-sm font-medium text-ink/70">Share:</p>
              <div className="flex flex-wrap items-center gap-2.5">
                {channels.map((c) => (
                  <a
                    key={c.key}
                    href={c.href}
                    target={c.external ? "_blank" : undefined}
                    rel={c.external ? "noopener noreferrer" : undefined}
                    onClick={c.onClick}
                    aria-label={c.label}
                    title={c.label}
                    className={circle}
                    style={{ backgroundColor: c.color }}
                  >
                    {c.icon}
                  </a>
                ))}
                {canNativeShare && (
                  <button
                    type="button"
                    onClick={nativeShare}
                    aria-label="More sharing options, including the QR code"
                    title="More options (includes the QR code)"
                    className={`${circle} bg-primary`}
                  >
                    {ICONS.more}
                  </button>
                )}
              </div>
              <p className="mt-2 h-4 text-xs text-ink/50" role="status" aria-live="polite">
                {notice}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 sm:w-48">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt={qrType === "invite" ? "QR code for your team invite link" : "QR code for your referral link"}
              width={192}
              height={192}
              className="h-44 w-44 rounded-2xl border border-line p-2 sm:h-48 sm:w-48"
            />
            <a
              href={`${qrUrl}${qrUrl.includes("?") ? "&" : "?"}download=1`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Download QR
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function ShareButton({
  affiliateId,
  referralLink,
  discountCode,
}: {
  affiliateId: string;
  referralLink: string;
  discountCode: string | null;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Share your link, code and QR"
        aria-haspopup="dialog"
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary-dark sm:px-4"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 3.9M15.4 6.6L8.6 10.5" />
        </svg>
        <span className="hidden sm:inline">Share</span>
      </button>
      {open && (
        <ShareDialog
          affiliateId={affiliateId}
          referralLink={referralLink}
          discountCode={discountCode}
          onClose={close}
        />
      )}
    </>
  );
}
