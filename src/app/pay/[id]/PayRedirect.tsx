"use client";

import { useEffect, useRef } from "react";

const buttonClass =
  "inline-flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90";

/**
 * Sends the member to Authorize.net's secure payment page. The token has to be POSTed, so this is
 * a form that submits itself; the button is there for anyone whose browser blocks that, or who
 * came back from the payment page and wants to try again.
 */
export default function PayRedirect({
  actionUrl,
  token,
  label,
  auto,
}: {
  actionUrl: string;
  token: string;
  label: string;
  auto: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (auto) form.current?.submit();
  }, [auto]);

  return (
    <form ref={form} method="post" action={actionUrl}>
      <input type="hidden" name="token" value={token} />
      <button type="submit" className={buttonClass}>
        {label}
      </button>
      {auto && <p className="mt-3 text-center text-xs text-ink/50">Taking you to our secure payment page…</p>}
    </form>
  );
}
