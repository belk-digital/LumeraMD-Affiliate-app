import type { Prisma } from "@/generated/prisma/client";
import { PLANS } from "@/lib/membership/plans";

// The search, filters and paging shared by the admin Signups pages and their CSV exports, so a
// download always matches what's on screen.

export const SIGNUPS_PAGE_SIZE = 20;

export const CUSTOMER_STATUS_FILTERS = ["pending_payment", "active", "past_due", "cancelled", "complimentary"] as const;
export const REP_STATUS_FILTERS = ["pending", "approved", "rejected"] as const;
export const RANGE_FILTERS = { "7": 7, "30": 30, "90": 90, "365": 365 } as const;

export interface SignupQuery {
  q: string;
  status: string;
  plan: string;
  range: string;
  /** "oldest" or "newest" (default). */
  sort: string;
  page: number;
}

type RawParams = { [key: string]: string | string[] | undefined };

const first = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export function parseSignupQuery(sp: RawParams | URLSearchParams): SignupQuery {
  const get = (key: string) => (sp instanceof URLSearchParams ? (sp.get(key) ?? "") : first(sp[key]));
  const page = parseInt(get("page"), 10);
  return {
    q: get("q").trim().slice(0, 100),
    status: get("status"),
    plan: get("plan"),
    range: get("range"),
    sort: get("sort") === "oldest" ? "oldest" : "newest",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function createdSince(range: string): Date | undefined {
  const days = RANGE_FILTERS[range as keyof typeof RANGE_FILTERS];
  return days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : undefined;
}

/** Every word typed must appear somewhere in one of the fields ("jane doe" finds first=Jane, last=Doe). */
function wordSearch<T extends string>(q: string, fields: T[]) {
  return q
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({ OR: fields.map((f) => ({ [f]: { contains: word, mode: "insensitive" as const } })) }));
}

export function customerWhere(query: SignupQuery): Prisma.CustomerSignupWhereInput {
  const where: Prisma.CustomerSignupWhereInput = {};
  const and: Prisma.CustomerSignupWhereInput[] = [];

  if (query.q) and.push(...(wordSearch(query.q, ["firstName", "lastName", "email", "phone"]) as Prisma.CustomerSignupWhereInput[]));

  if (query.status === "complimentary") {
    where.status = "active";
    where.complimentary = true;
  } else if ((CUSTOMER_STATUS_FILTERS as readonly string[]).includes(query.status)) {
    where.status = query.status as "pending_payment" | "active" | "past_due" | "cancelled";
  }
  if (query.plan in PLANS) where.plan = query.plan;

  const since = createdSince(query.range);
  if (since) where.createdAt = { gte: since };
  if (and.length) where.AND = and;
  return where;
}

export function repWhere(query: SignupQuery): Prisma.SalesRepSignupWhereInput {
  const where: Prisma.SalesRepSignupWhereInput = {};
  const and: Prisma.SalesRepSignupWhereInput[] = [];

  if (query.q) and.push(...(wordSearch(query.q, ["firstName", "lastName", "email", "phone", "salesType"]) as Prisma.SalesRepSignupWhereInput[]));
  if ((REP_STATUS_FILTERS as readonly string[]).includes(query.status)) {
    where.status = query.status as "pending" | "approved" | "rejected";
  }
  const since = createdSince(query.range);
  if (since) where.createdAt = { gte: since };
  if (and.length) where.AND = and;
  return where;
}

/** Change over the last 30 days against the 30 before, for the stat cards. */
export function trendPercent(current30: number, previous30: number): number {
  if (previous30 === 0) return current30 > 0 ? 100 : 0;
  return Math.round(((current30 - previous30) / previous30) * 100);
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** The plan as the admin sees it. The rep plan shares the "Premium" name with the customer one. */
export function planLabel(key: string): string {
  const plan = PLANS[key as keyof typeof PLANS];
  if (!plan) return key;
  return key === "agent" ? "Premium (rep)" : plan.name;
}
