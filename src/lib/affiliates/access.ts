import { redirect } from "next/navigation";
import { getAffiliateSession } from "@/lib/affiliates/session";
import { getAdminSession } from "@/lib/admin/session";

/** Affiliates can see their own dashboard; admins can see any. */
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
  redirect("/login");
}
