import { prisma } from "@/lib/prisma";
import type { CustomerSignup } from "@/generated/prisma/client";
import { monthlyPriceFor, type PlanKey } from "@/lib/membership/plans";
import { getCatalog } from "@/lib/membership/plans.server";
import { AuthnetError, cancelSubscription, createMonthlySubscription } from "@/lib/authnet/client";

// Pausing a suspended rep's $79 Premium billing. Authorize.net's API can only cancel a subscription
// (suspending one is dashboard-only), so a pause cancels it and keeps the saved card on the member's
// record; resuming starts a new subscription from that card. Both return warnings for the admin
// instead of throwing: the status change itself must never fail because of billing.

async function repMembership(email: string) {
  return prisma.customerSignup.findFirst({
    where: { plan: "agent", email: { equals: email, mode: "insensitive" } },
  });
}

/** Stops the monthly charge for a rep who has just been suspended. The membership record is left as it is. */
export async function pauseRepBilling(affiliate: { userEmail: string }): Promise<string[]> {
  const member = await repMembership(affiliate.userEmail);
  if (!member?.authnetSubscriptionId) return [];
  try {
    await cancelSubscription(member.authnetSubscriptionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Already stopped on their side is the result we wanted.
    if (!(err instanceof AuthnetError && /cancel|terminat/i.test(message))) {
      console.error("Could not pause rep billing", member.authnetSubscriptionId, message);
      return [
        `The rep is suspended, but their Authorize.net subscription (${member.authnetSubscriptionId}) could not be stopped: ${message}. Cancel it in Authorize.net so they are not charged while suspended.`,
      ];
    }
  }
  await prisma.customerSignup.update({ where: { id: member.id }, data: { authnetSubscriptionId: null } });
  return [];
}

/**
 * Starts the monthly charge again for a rep who has just been reactivated, from the card saved on
 * their last payment, on the day their paid period ends. If the period ran out while they were
 * suspended, or no card is saved, nothing is charged: the admin is told and the rep pays through
 * the usual pay link.
 */
export async function resumeRepBilling(affiliate: { userEmail: string }): Promise<string[]> {
  const member = await repMembership(affiliate.userEmail);
  if (!member || member.authnetSubscriptionId || member.complimentary || member.status === "paused") return [];
  // Only members who were being billed by card have a saved one; manual and free members are left alone.
  if (!member.authnetCustomerProfileId || !member.authnetPaymentProfileId) return [];

  const plan = (await getCatalog()).plans.agent;
  const covered = member.status === "active" && member.currentPeriodEnd && member.currentPeriodEnd > new Date();
  if (!covered) {
    return [
      `${member.email}'s Premium membership ran out while they were suspended, so their card was not charged. Send them a pay link from Signups › Sales reps to renew it.`,
    ];
  }

  try {
    const subscriptionId = await createMonthlySubscription({
      customerId: member.id,
      name: `${plan.name} membership`,
      amount: monthlyPriceFor(member, plan),
      startDate: member.currentPeriodEnd!,
      customerProfileId: member.authnetCustomerProfileId,
      paymentProfileId: member.authnetPaymentProfileId,
    });
    const saved = await prisma.customerSignup.updateMany({
      where: { id: member.id, authnetSubscriptionId: null },
      data: { authnetSubscriptionId: subscriptionId },
    });
    if (saved.count === 0) await cancelSubscription(subscriptionId).catch(() => {});
    return [];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Could not resume rep billing", member.email, message);
    return [
      `The rep is active again, but their monthly billing could not be restarted: ${message}. Send them a pay link from Signups › Sales reps.`,
    ];
  }
}

/**
 * Starts the monthly card charge again for a membership an admin has switched back on, from the card saved on
 * their last payment, on the day their paid period ends. Returns `started` plus warnings for the admin; never throws.
 */
export async function resumeMemberCardBilling(member: CustomerSignup): Promise<{ started: boolean; warnings: string[] }> {
  if (member.authnetSubscriptionId || member.complimentary) return { started: false, warnings: [] };
  // Only members who were billed by card have a saved one; manual members are left alone.
  if (!member.authnetCustomerProfileId || !member.authnetPaymentProfileId || !member.currentPeriodEnd) {
    return { started: false, warnings: [] };
  }
  const plan = (await getCatalog()).plans[member.plan as PlanKey];
  if (!plan) return { started: false, warnings: [] };
  try {
    const subscriptionId = await createMonthlySubscription({
      customerId: member.id,
      name: `${plan.name} membership`,
      amount: monthlyPriceFor(member, plan),
      startDate: member.currentPeriodEnd,
      customerProfileId: member.authnetCustomerProfileId,
      paymentProfileId: member.authnetPaymentProfileId,
    });
    const saved = await prisma.customerSignup.updateMany({
      where: { id: member.id, authnetSubscriptionId: null },
      data: { authnetSubscriptionId: subscriptionId },
    });
    if (saved.count === 0) await cancelSubscription(subscriptionId).catch(() => {});
    return { started: saved.count > 0, warnings: [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Could not resume member billing", member.email, message);
    return {
      started: false,
      warnings: [`The membership is active again, but its monthly card billing could not be restarted: ${message}. Send them the payment link so they can renew.`],
    };
  }
}
