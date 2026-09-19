import { prisma } from "@/lib/prisma";

export type NotificationType =
  | "welcome"
  | "commission_earned"
  | "commission_approved"
  | "commission_reversed"
  | "team_earning"
  | "recruit_joined"
  | "payout_requested"
  | "payout_approved"
  | "payout_paid"
  | "payout_rejected";

export async function createNotification(
  affiliateId: string,
  n: { type: NotificationType; title: string; body?: string },
) {
  try {
    await prisma.notification.create({ data: { affiliateId, ...n } });
  } catch (err) {
    console.error("Failed to create notification", err);
  }
}
