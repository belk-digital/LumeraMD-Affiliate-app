import { requireCustomer } from "@/lib/customers/requireCustomer";
import { getWalletSummary } from "@/lib/wallet/ledger";
import { getWalletRules } from "@/lib/wallet/service";
import { formatPoints } from "@/lib/wallet/rules";
import AccountShell from "../AccountShell";
import WalletCard from "../WalletCard";
import { Card, DataTable, Page, PageHeader, PointsDelta, fmtDate } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wallet · LumeraMD" };

export default async function WalletPage() {
  const customer = await requireCustomer();
  const [rules, wallet] = await Promise.all([
    getWalletRules(),
    getWalletSummary("customer", customer.email, 50),
  ]);
  const isActive = customer.status === "active";

  const redeemBlockedReason = !rules.enabled
    ? "Wallet points are paused right now. Your balance is safe."
    : !isActive
      ? "Redeeming is available while your membership is active."
      : wallet.balanceCents < rules.minRedeemCents
        ? `You can redeem once you have at least ${(rules.minRedeemCents / 100).toFixed(2)} points.`
        : null;

  return (
    <AccountShell name={`${customer.firstName} ${customer.lastName}`.trim()} email={customer.email}>
      <Page>
        <PageHeader title="Wallet" subtitle="Your points and rewards." />

        <WalletCard
          enabled={rules.enabled}
          canRedeem={redeemBlockedReason === null}
          redeemBlockedReason={redeemBlockedReason}
          balanceCents={wallet.balanceCents}
          minRedeemCents={rules.minRedeemCents}
          expiryDays={rules.redeemExpiryDays}
          earn={{
            orderPercent: rules.orderEarnPercent,
            orderMin: rules.orderMinSubtotal,
            membershipPercent: rules.membershipEarnPercent,
          }}
          codes={wallet.pendingRedemptions.map((r) => ({
            id: r.id,
            code: r.code,
            amountCents: r.amountCents,
            expires: fmtDate(r.expiresAt),
          }))}
        />

        <Card title="Recent activity" icon="chart">
          <DataTable
            headers={["Date", "Description", "Points", "Balance"]}
            align={["left", "left", "right", "right"]}
            empty="Your wallet activity will appear here once you earn or spend points."
            rows={wallet.transactions.map((t) => [
              fmtDate(t.createdAt),
              <span key={t.id} className="font-medium text-ink">{t.reason ?? t.type}</span>,
              <PointsDelta key={`p${t.id}`} cents={t.amountCents} />,
              formatPoints(t.balanceAfterCents),
            ])}
          />
          {wallet.transactions.length >= 50 && (
            <p className="mt-3 text-xs text-ink/45">Showing your 50 most recent entries.</p>
          )}
        </Card>
      </Page>
    </AccountShell>
  );
}
