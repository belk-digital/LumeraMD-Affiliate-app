const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;
const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2025-07";

function adminUrl(path: string) {
  return `https://${STORE_DOMAIN}/admin/api/${API_VERSION}${path}`;
}

export async function shopifyAdminFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(adminUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": ACCESS_TOKEN,
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shopify Admin API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

async function shopifyGraphQL<T>(query: string, variables: Record<string, unknown>) {
  const res = await fetch(
    `https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ACCESS_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  const json = (await res.json()) as GraphQLResponse<T>;
  if (!res.ok || json.errors) {
    throw new Error(
      `Shopify GraphQL error: ${JSON.stringify(json.errors ?? json)}`,
    );
  }
  return json.data as T;
}

export async function createDiscountCode(params: {
  title: string;
  code: string;
  valueType: "percentage" | "fixed_amount";
  value: number;
}) {
  const mutation = /* GraphQL */ `
    mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const customerGets =
    params.valueType === "percentage"
      ? { value: { percentage: params.value / 100 }, items: { all: true } }
      : {
          value: {
            discountAmount: { amount: params.value, appliesOnEachItem: false },
          },
          items: { all: true },
        };

  const result = await shopifyGraphQL<{
    discountCodeBasicCreate: {
      codeDiscountNode: { id: string } | null;
      userErrors: { field: string[]; message: string }[];
    };
  }>(mutation, {
    basicCodeDiscount: {
      title: params.title,
      code: params.code,
      startsAt: new Date().toISOString(),
      customerSelection: { all: true },
      customerGets,
      appliesOncePerCustomer: false,
    },
  });

  const { userErrors, codeDiscountNode } = result.discountCodeBasicCreate;
  if (userErrors.length > 0) {
    throw new Error(`Discount creation failed: ${JSON.stringify(userErrors)}`);
  }
  return codeDiscountNode;
}

export async function registerWebhook(topic: string, address: string) {
  return shopifyAdminFetch("/webhooks.json", {
    method: "POST",
    body: JSON.stringify({
      webhook: { topic, address, format: "json" },
    }),
  });
}
