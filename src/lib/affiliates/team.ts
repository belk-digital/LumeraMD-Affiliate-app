import { prisma } from "@/lib/prisma";
import type { Affiliate } from "@/generated/prisma/client";

/**
 * Whether the dashboard should show an affiliate their Team page: yes if an admin lets them
 * recruit, and also if they already have team members (switching recruiting off never hides the
 * people who are already on their team).
 */
export async function canSeeTeam(affiliate: Pick<Affiliate, "id" | "canRecruit">): Promise<boolean> {
  if (affiliate.canRecruit) return true;
  const members = await prisma.affiliate.count({ where: { parentAffiliateId: affiliate.id } });
  return members > 0;
}
