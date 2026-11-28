import { prisma } from "@/lib/prisma";
import type { CustomerSignup } from "@/generated/prisma/client";
import { monthlyPriceFor, type PlanKey } from "@/lib/membership/plans";
import { getCatalog } from "@/lib/membership/plans.server";
import { recordMembershipPayment, type LifecycleOptions } from "@/lib/membership/lifecycle";
import {
  cancelSubscription,
  createMonthlySubscription,
  createProfileFromTransaction,
  customerIdFromTag,
  getTransactionDetails,
} from "@/lib/authnet/client";

/** The `source` stored on a MembershipPayment made through Authorize.net. */
export const AUTHNET_SOURCE = "authorizenet";

// A charge that went through. Declined, voided and still-pending transactions are not payments.
const PAID_STATUSES = new Set(["capturedPendingSettlement", "settledSuccessfully"]);

export type AuthnetPaymentOutcome =
  | { outcome: "recorded"; customerId: string; duplicate: boolean; subscriptionId: string | null }
  | { outcome: "ignored"; reason: string };

/**
 * Turns a paid Authorize.net transaction into a membership payment. Called from the webhook for
 * every charge on the merchant account, so anything that is not a member's payment is ignored.
 *
 * - First payment (hosted page): records it, then saves the card and starts a monthly subscription.
 * - Renewal (the subscription's own charge): records it.
 *
 * Safe to run twice for the same transaction (Authorize.net retries webhooks that fail). Throws if
 * the payment was recorded but renewals could not be set up, so the webhook fails and is retried.
 */
export async function handleAuthnetPayment(
  transId: string,
  opts: LifecycleOptions = {},
): Promise<AuthnetPaymentOutcome> {
  const details = await getTransactionDetails(transId);
  if (!PAID_STATUSES.has(details.status)) {
    return { outcome: "ignored", reason: `transaction is ${details.status || "in an unknown state"}` };
  }

  let customer: CustomerSignup | null = null;
  if (details.subscriptionId) {
    customer = await prisma.customerSignup.findUnique({ where: { authnetSubscriptionId: details.subscriptionId } });
  }
  if (!customer) {
    const id = customerIdFromTag(details.tag);
    if (id) customer = await prisma.customerSignup.findUnique({ where: { id } });
  }
  if (!customer) return { outcome: "ignored", reason: "not a membership payment" };

  // A cancelled member must never be brought back by a late charge. Stop the subscription again and
  // leave this in the log: the money was taken, so it needs refunding by hand.
  if (customer.status === "cancelled") {
    console.error(
      `Authorize.net charged cancelled member ${customer.email} (transaction ${transId}, $${details.amount}). Refund it.`,
    );
    if (customer.authnetSubscriptionId) await cancelSubscription(customer.authnetSubscriptionId).catch(() => {});
    return { outcome: "ignored", reason: "member is cancelled; refund needed" };
  }

  const result = await recordMembershipPayment(
    {
      customerId: customer.id,
      amount: details.amount,
      source: AUTHNET_SOURCE,
      externalId: transId,
      note: details.subscriptionId ? "Monthly subscription charge" : "Paid on the payment page",
    },
    opts,
  );

  let subscriptionId = customer.authnetSubscriptionId;
  // Renewal charges already come from a subscription. Only a payment made on the hosted page needs
  // the card saved and a subscription started.
  if (!details.subscriptionId) {
    const fresh = await prisma.customerSignup.findUniqueOrThrow({ where: { id: customer.id } });
    // A new payment (not a webhook retry) means a new card: replace any older subscription with it.
    if (!result.duplicate && fresh.authnetSubscriptionId) {
      await cancelSubscription(fresh.authnetSubscriptionId).catch((err) =>
        console.error("Could not cancel the previous subscription", fresh.authnetSubscriptionId, err),
      );
      await prisma.customerSignup.update({ where: { id: fresh.id }, data: { authnetSubscriptionId: null } });
      fresh.authnetSubscriptionId = null;
    }
    if (!fresh.authnetSubscriptionId) {
      subscriptionId = await setUpRenewals(fresh, transId, result.payment.periodEnd, result.duplicate);
    } else {
      subscriptionId = fresh.authnetSubscriptionId;
    }
  }

  return { outcome: "recorded", customerId: customer.id, duplicate: result.duplicate, subscriptionId };
}

/** Saves the card used in this payment and starts a monthly subscription from the day this one runs out. */
async function setUpRenewals(
  customer: CustomerSignup,
  transId: string,
  firstRenewal: Date,
  retry: boolean,
): Promise<string> {
  const plan = (await getCatalog()).plans[customer.plan as PlanKey];
  if (!plan) throw new Error(`Unknown plan "${customer.plan}" for ${customer.email}`);

  // On a webhook retry for this same payment the card is already saved (Authorize.net refuses to
  // save one transaction's card twice), so reuse it. A new payment may be a new card: save that one.
  let profile =
    retry && customer.authnetCustomerProfileId && customer.authnetPaymentProfileId
      ? { customerProfileId: customer.authnetCustomerProfileId, paymentProfileId: customer.authnetPaymentProfileId }
      : null;
  if (!profile) {
    profile = await createProfileFromTransaction(transId, customer.id);
    await prisma.customerSignup.update({
      where: { id: customer.id },
      data: { authnetCustomerProfileId: profile.customerProfileId, authnetPaymentProfileId: profile.paymentProfileId },
    });
  }

  const subscriptionId = await createMonthlySubscription({
    customerId: customer.id,
    name: `${plan.name} membership`,
    amount: monthlyPriceFor(customer, plan),
    startDate: firstRenewal,
    ...profile,
  });

  // If two deliveries of the same webhook raced, only one subscription may stay.
  const saved = await prisma.customerSignup.updateMany({
    where: { id: customer.id, authnetSubscriptionId: null },
    data: { authnetSubscriptionId: subscriptionId },
  });
  if (saved.count === 0) {
    await cancelSubscription(subscriptionId).catch(() => {});
    const current = await prisma.customerSignup.findUniqueOrThrow({ where: { id: customer.id } });
    return current.authnetSubscriptionId ?? subscriptionId;
  }
  return subscriptionId;
}
