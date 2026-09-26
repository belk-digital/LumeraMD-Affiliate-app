import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/requireAdmin";

const SECTIONS = [
  {
    title: "Approving applications",
    body: [
      "New applications appear on the dashboard and under Applications. Approve creates the affiliate, their referral link and a matching discount code in Shopify, then emails and notifies them.",
      "Reject closes the application without creating anything. If approval fails (for example Shopify is unreachable) you'll see the error and can retry.",
    ],
  },
  {
    title: "How a commission moves",
    body: [
      "Pending → an order using the affiliate's link or code is paid. The commission waits out the pending period (a protection window for refunds).",
      "Approved → once the pending period has passed and the commission job runs (/api/cron/process-commissions, secured with CRON_SECRET), it becomes payable.",
      "Paid → after you mark the related payout as paid. Reversed → the order was refunded or cancelled. Voided → a detected self-referral, which earns nothing.",
    ],
  },
  {
    title: "Handling payouts",
    body: [
      "Affiliates request payouts from their dashboard once they reach the minimum. Under Payouts: Approve, then Mark Paid after you've sent the money — that flips the linked commissions to Paid.",
      "Reject declines a request; the affiliate is notified either way.",
    ],
  },
  {
    title: "Refunds and corrections",
    body: [
      "Shopify refund events reverse the matching commission automatically. To undo one by hand, use Reverse on the Conversions page. Reversals notify the affiliate.",
    ],
  },
  {
    title: "Finding things",
    body: [
      "The search bar looks up affiliates by name, email, referral slug, discount code or ID. The bell lists pending applications and payout requests and refreshes about every 20 seconds. The date range at the top controls the dashboard figures.",
    ],
  },
];

export default async function AdminHelpPage() {
  await requireAdminPage();

  return (
    <div className="max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Help</h1>
        <p className="mt-1 text-sm text-ink/60">
          How the admin panel and the commission lifecycle work.
        </p>
      </div>

      {SECTIONS.map((s) => (
        <section key={s.title} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h2 className="font-heading text-base font-semibold text-ink">{s.title}</h2>
          <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink/70">
            {s.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </section>
      ))}

      <p className="text-sm text-ink/50">
        Program defaults (commission, cookie length, pending period, minimum payout) live in{" "}
        <Link href="/lumera-ops/settings" className="text-primary hover:underline">
          Settings
        </Link>
        .
      </p>
    </div>
  );
}
