import { redirect } from "next/navigation";
import { getAffiliateSession, getInactiveAffiliate } from "@/lib/affiliates/session";
import { getAdminSession } from "@/lib/admin/session";

/** Affiliates can see their own dashboard while approved; admins can see any. */
export async function hasAffiliateAccess(affiliateId: string) {
  const session = await getAffiliateSession();
  if (session?.affiliateId === affiliateId) return true;
  return (await getAdminSession()) !== null;
}

/** For pages: checked per page (not in a layout) since layouts don't re-run on client navigations. */
export async function requireAffiliateAccess(affiliateId: string) {
  if (await hasAffiliateAccess(affiliateId)) return;

  const session = await getAffiliateSession();
  if (session) redirect(`/affiliates/dashboard/${session.affiliateId}`);
  // Still holding a sign-in, but suspended since: say so instead of dropping them on the login form.
  if (await getInactiveAffiliate()) redirect("/affiliates/suspended");
  redirect("/login");
}
