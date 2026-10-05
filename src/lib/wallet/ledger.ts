import { prisma } from "@/lib/prisma";
import type {
  Prisma,
  WalletAccount,
  WalletKind,
  WalletRedemption,
  WalletTransaction,
  WalletTxType,
} from "@/generated/prisma/client";

// The wallet ledger. Every change to a balance goes through applyWalletEntry, which:
//   * locks the account row, so changes to one wallet are strictly serialized (two tabs, a webhook
//     retry and a cron job can't interleave);
//   * checks the idempotency key under that lock, so a repeated request is a no-op;
//   * writes the new balance and the ledger row in one database transaction;
//   * refuses to go below zero (and the database has a CHECK constraint as a second guard).

export class WalletError extends Error {
  constructor(
    message: string,
    public code: "invalid" | "insufficient" | "disabled" | "not_member" | "too_small" | "shopify",
  ) {
    super(message);
  }
}

/** Customers are keyed by lowercased email (it survives cancelling and rejoining); affiliates by id. */
export function ownerKeyFor(kind: WalletKind, key: string): string {
  return kind === "customer" ? key.trim().toLowerCase() : key;
}

const isUniqueViolation = (e: unknown) =>
  typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

export async function ensureWalletAccount(kind: WalletKind, ownerKey: string): Promise<WalletAccount> {
  const key = ownerKeyFor(kind, ownerKey);
  try {
    return await prisma.walletAccount.upsert({
      where: { kind_ownerKey: { kind, ownerKey: key } },
      update: {},
      create: { kind, ownerKey: key },
    });
  } catch (e) {
    // Two requests created the same account at once; the loser just reads the winner's row.
    if (isUniqueViolation(e)) {
      return prisma.walletAccount.findUniqueOrThrow({ where: { kind_ownerKey: { kind, ownerKey: key } } });
    }
    throw e;
  }
}

// Changes to one wallet queue behind its row lock, and every query is a round trip to a remote
// database, so allow far more than Prisma's 5-second default before giving up.
const TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 };

export interface EntryParams {
  kind: WalletKind;
  ownerKey: string;
  /** Signed whole cents: credit positive, debit negative. Never zero. */
  amountCents: number;
  type: WalletTxType;
  reason?: string;
  sourceType?: string;
  sourceId?: string;
  /** A repeated call with the same key changes nothing and returns the original entry. */
  idempotencyKey?: string;
  meta?: Prisma.InputJsonValue;
  createdBy?: string;
  /** Debits only: take whatever is there (down to zero) instead of failing when the balance is short. */
  allowPartial?: boolean;
}

export interface EntryResult {
  applied: boolean;
  duplicate: boolean;
  /** Signed amount actually applied (can be smaller than asked for with allowPartial). */
  appliedCents: number;
  entry: WalletTransaction | null;
  balanceCents: number;
}

export async function applyWalletEntry(p: EntryParams): Promise<EntryResult> {
  if (!Number.isInteger(p.amountCents) || p.amountCents === 0) {
    throw new WalletError("The amount must be a non-zero whole number of cents.", "invalid");
  }
  const account = await ensureWalletAccount(p.kind, p.ownerKey);

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ balanceCents: number }[]>`
      SELECT "balanceCents" FROM "wallet_accounts" WHERE "id" = ${account.id} FOR UPDATE`;
    const current = Number(rows[0].balanceCents);

    if (p.idempotencyKey) {
      const existing = await tx.walletTransaction.findUnique({ where: { idempotencyKey: p.idempotencyKey } });
      if (existing) {
        return { applied: false, duplicate: true, appliedCents: 0, entry: existing, balanceCents: current };
      }
    }

    let delta = p.amountCents;
    if (delta < 0 && current + delta < 0) {
      if (!p.allowPartial) throw new WalletError("Not enough points.", "insufficient");
      delta = -current;
      if (delta === 0) {
        return { applied: false, duplicate: false, appliedCents: 0, entry: null, balanceCents: current };
      }
    }

    const next = current + delta;
    await tx.walletAccount.update({ where: { id: account.id }, data: { balanceCents: next } });
    const entry = await tx.walletTransaction.create({
      data: {
        accountId: account.id,
        type: p.type,
        amountCents: delta,
        balanceAfterCents: next,
        reason: p.reason,
        sourceType: p.sourceType,
        sourceId: p.sourceId,
        idempotencyKey: p.idempotencyKey,
        meta: p.meta,
        createdBy: p.createdBy,
      },
    });
    return { applied: true, duplicate: false, appliedCents: delta, entry, balanceCents: next };
  }, TX_OPTIONS);
}

type CreditParams = Omit<EntryParams, "amountCents" | "type" | "allowPartial"> & {
  amountCents: number;
  type?: Extract<WalletTxType, "earn" | "refund" | "adjustment">;
};
type DebitParams = Omit<EntryParams, "amountCents" | "type"> & {
  amountCents: number;
  type?: Extract<WalletTxType, "redeem" | "clawback" | "adjustment">;
};

export function creditWallet(p: CreditParams): Promise<EntryResult> {
  return applyWalletEntry({ ...p, amountCents: Math.abs(p.amountCents), type: p.type ?? "earn" });
}

export function debitWallet(p: DebitParams): Promise<EntryResult> {
  return applyWalletEntry({ ...p, amountCents: -Math.abs(p.amountCents), type: p.type ?? "redeem" });
}

export interface WalletSummary {
  accountId: string | null;
  balanceCents: number;
  transactions: WalletTransaction[];
  pendingRedemptions: WalletRedemption[];
}

export async function getWalletSummary(kind: WalletKind, ownerKey: string, limit = 20): Promise<WalletSummary> {
  const account = await prisma.walletAccount.findUnique({
    where: { kind_ownerKey: { kind, ownerKey: ownerKeyFor(kind, ownerKey) } },
  });
  if (!account) return { accountId: null, balanceCents: 0, transactions: [], pendingRedemptions: [] };
  const [transactions, pendingRedemptions] = await Promise.all([
    prisma.walletTransaction.findMany({ where: { accountId: account.id }, orderBy: { createdAt: "desc" }, take: limit }),
    prisma.walletRedemption.findMany({
      where: { accountId: account.id, status: "pending" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { accountId: account.id, balanceCents: account.balanceCents, transactions, pendingRedemptions };
}

/** Balances for many customers at once (admin lists), keyed by lowercased email. */
export async function getCustomerBalances(emails: string[]): Promise<Map<string, number>> {
  const keys = [...new Set(emails.map((e) => ownerKeyFor("customer", e)))];
  if (keys.length === 0) return new Map();
  const accounts = await prisma.walletAccount.findMany({
    where: { kind: "customer", ownerKey: { in: keys } },
    select: { ownerKey: true, balanceCents: true },
  });
  return new Map(accounts.map((a) => [a.ownerKey, a.balanceCents]));
}

/** The ledger must add up to the cached balance. Used by tests and the admin audit. */
export async function verifyWalletIntegrity(accountId: string): Promise<{ ok: boolean; balanceCents: number; ledgerCents: number }> {
  const [account, sum] = await Promise.all([
    prisma.walletAccount.findUniqueOrThrow({ where: { id: accountId } }),
    prisma.walletTransaction.aggregate({ where: { accountId }, _sum: { amountCents: true } }),
  ]);
  const ledgerCents = sum._sum.amountCents ?? 0;
  return { ok: ledgerCents === account.balanceCents, balanceCents: account.balanceCents, ledgerCents };
}
