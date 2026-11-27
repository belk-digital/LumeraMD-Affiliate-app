// Shared by the /ref/<slug> redirect and the admin Referral tab, so the tab shows exactly what a click does.

/** Where a referral click lands in the store: the full catalog, not the homepage. */
export const LANDING_PATH = "/collections/all-products";

/** Tags added to the landing URL on every referral click, so store analytics can attribute the visit. */
export function utmParamsFor(slug: string): Record<string, string> {
  return { utm_source: "affiliate", utm_medium: "referral", utm_campaign: slug };
}

/** The store landing URL (without the per-click tracking values) for an affiliate, UTM tags included. */
export function storeLandingUrl(slug: string): string {
  const domain = process.env.SHOPIFY_PUBLIC_DOMAIN ?? process.env.SHOPIFY_STORE_DOMAIN ?? "";
  const url = new URL(LANDING_PATH, `https://${domain}`);
  for (const [k, v] of Object.entries(utmParamsFor(slug))) url.searchParams.set(k, v);
  return url.toString();
}
