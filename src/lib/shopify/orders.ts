import { shopifyGraphQL } from "@/lib/shopify/client";

// A member's store orders, read from Shopify by the email on their membership. We don't keep
// orders ourselves: Shopify is the source of truth, so this is fetched when the page is opened.

export type OrderStatus = "processing" | "shipped" | "delivered" | "cancelled";

export interface MemberOrder {
  id: string;
  /** e.g. "#1001" */
  name: string;
  createdAt: string;
  itemCount: number;
  items: { title: string; quantity: number }[];
  total: number;
  currency: string;
  status: OrderStatus;
  /** Shopify's own order-status page for this order, if it has one. */
  statusUrl: string | null;
}

interface ShopifyOrderNode {
  id: string;
  name: string;
  createdAt: string;
  cancelledAt: string | null;
  displayFulfillmentStatus: string;
  statusPageUrl: string | null;
  currentTotalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  lineItems: { nodes: { title: string; quantity: number }[] };
  fulfillments: { displayStatus: string | null }[];
}

/**
 * Cancelled wins; then delivered (everything shipped has been delivered); then shipped (something
 * has left the warehouse); otherwise the order is still being prepared.
 */
export function mapOrderStatus(o: {
  cancelledAt: string | null;
  displayFulfillmentStatus: string;
  fulfillments: { displayStatus: string | null }[];
}): OrderStatus {
  if (o.cancelledAt) return "cancelled";
  const shipments = o.fulfillments ?? [];
  if (shipments.length > 0) {
    if (o.displayFulfillmentStatus === "FULFILLED" && shipments.every((f) => f.displayStatus === "DELIVERED")) {
      return "delivered";
    }
    return "shipped";
  }
  return "processing";
}

export function mapOrder(node: ShopifyOrderNode): MemberOrder {
  const items = node.lineItems.nodes.map((l) => ({ title: l.title, quantity: l.quantity }));
  return {
    id: node.id,
    name: node.name,
    createdAt: node.createdAt,
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    total: Number(node.currentTotalPriceSet.shopMoney.amount) || 0,
    currency: node.currentTotalPriceSet.shopMoney.currencyCode,
    status: mapOrderStatus(node),
    statusUrl: node.statusPageUrl,
  };
}

const QUERY = /* GraphQL */ `
  query MemberOrders($query: String!) {
    orders(first: 50, query: $query, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        name
        createdAt
        cancelledAt
        displayFulfillmentStatus
        statusPageUrl
        currentTotalPriceSet { shopMoney { amount currencyCode } }
        lineItems(first: 10) { nodes { title quantity } }
        fulfillments(first: 5) { displayStatus }
      }
    }
  }
`;

/** Search-safe form of an email for Shopify's order search syntax. */
export function orderSearchQuery(email: string): string {
  return `email:"${email.trim().replace(/["\\]/g, "")}"`;
}

/** Fixed sample orders for looking at the page locally. Never active in production. */
function demoOrders(): MemberOrder[] {
  const day = 24 * 60 * 60 * 1000;
  const mk = (n: number, daysAgo: number, items: [string, number][], total: number, status: OrderStatus): MemberOrder => ({
    id: `demo-${n}`,
    name: `#${n}`,
    createdAt: new Date(Date.now() - daysAgo * day).toISOString(),
    items: items.map(([title, quantity]) => ({ title, quantity })),
    itemCount: items.reduce((s, [, q]) => s + q, 0),
    total,
    currency: "USD",
    status,
    statusUrl: null,
  });
  return [
    mk(1048, 3, [["Peptide Starter Kit", 1], ["Wellness Supplement", 1]], 299, "processing"),
    mk(1031, 21, [["Collagen Peptides", 1]], 189, "shipped"),
    mk(1012, 58, [["Peptide Starter Kit", 2], ["Recovery Blend", 1]], 378, "delivered"),
    mk(994, 120, [["Wellness Supplement", 1]], 159, "delivered"),
    mk(971, 210, [["DNA Test Kit", 1], ["Recovery Blend", 1]], 249, "cancelled"),
  ];
}

/**
 * The member's orders, newest first. Never throws: if Shopify can't be reached the page shows a
 * friendly message instead of an error. Only ever called with the email from the member's own
 * logged-in membership, never with an email taken from the request.
 */
export async function listMemberOrders(email: string): Promise<{ orders: MemberOrder[]; error: string | null }> {
  if (process.env.NODE_ENV !== "production" && process.env.ORDERS_DEMO === "true") {
    return { orders: demoOrders(), error: null };
  }
  try {
    const data = await shopifyGraphQL<{ orders: { nodes: ShopifyOrderNode[] } }>(QUERY, {
      query: orderSearchQuery(email),
    });
    return { orders: data.orders.nodes.map(mapOrder), error: null };
  } catch (err) {
    console.error("Could not load member orders", err);
    return { orders: [], error: "We couldn't load your orders just now. Please try again in a moment." };
  }
}
