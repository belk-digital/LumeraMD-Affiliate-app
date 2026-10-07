import { prisma } from "@/lib/prisma";
import type { Affiliate, AffiliateSettings } from "@/generated/prisma/client";
import { createNotification } from "@/lib/notifications/create";
import { notifyActivityPassed, notifyActivitySuspended, notifyActivityWarning } from "@/lib/email/activity";

// The 90-day activity cycle. Every affiliate has a cycle (start and end). By the end of it they
// must have recruited N affiliates, or reached a sales amount (0 = recruiting only). If they did,
// they're active and a new cycle starts; if not, the account is suspended. Counts only include
// what happened inside the current cycle.
//
// "Active" also drives overrides: while this is switched on it replaces the monthly requirement,
// so an upline qualifies by being active and having enough active recruits.

const DAY = 24 * 60 * 60 * 1000;
/** Days before a cycle ends when a not-yet-qualified affiliate is warned (first and second email). */
export const WARNING_DAYS = [14, 3] as const;
const COUNTED = ["pending", "approved", "paid"] as const;

export interface ActivityRules {
  enabled: boolean;
  cycleDays: number;
  requiredRecruits: number;
  /** Own sales needed instead of the recruits; 0 means the sales route is off. */
  minSales: number;
}

export function activityRulesFromSettings(s: AffiliateSettings): ActivityRules {
  return {
    enabled: s.activityEnabled,
    cycleDays: s.activityCycleDays,
    requiredRecruits: s.activityRequiredRecruits,
    minSales: s.activityMinSales,
  };
}

export async function getActivityRules(): Promise<ActivityRules> {
  const settings = await prisma.affiliateSettings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });
  return activityRulesFromSettings(settings);
}

/** Pure: has this cycle's requirement been met? */
export function meetsRequirement(progress: { recruits: number; sales: number }, rules: ActivityRules): boolean {
  if (progress.recruits >= rules.requiredRecruits) return true;
  return rules.minSales > 0 && progress.sales >= rules.minSales;
}

type CycleSubject = Pick<Affiliate, "id" | "cycleStartedAt" | "cycleEndsAt">;

/** Recruits and own sales since the cycle started. */
export async function cycleProgress(affiliate: CycleSubject, rules: ActivityRules, upTo?: Date) {
  const start = affiliate.cycleStartedAt;
  const end = upTo ?? affiliate.cycleEndsAt;
  if (!start) return { recruits: 0, sales: 0, met: false };
  const [recruits, agg] = await Promise.all([
    prisma.affiliate.count({
      where: { parentAffiliateId: affiliate.id, status: "approved", createdAt: { gte: start } },
    }),
    prisma.affiliateConversion.aggregate({
      where: {
        affiliateId: affiliate.id,
        status: { in: [...COUNTED] },
        createdAt: end ? { gte: start, lt: end } : { gte: start },
      },
      _sum: { eligibleSubtotal: true },
    }),
  ]);
  const sales = agg._sum.eligibleSubtotal ?? 0;
  return { recruits, sales, met: meetsRequirement({ recruits, sales }, rules) };
}

/**
 * Currently active: approved, and either carried over from a passed cycle (activeUntil) or has
 * already met this cycle's requirement. A brand-new affiliate is not active until they do.
 */
export async function isCurrentlyActive(
  affiliate: Pick<Affiliate, "id" | "status" | "cycleStartedAt" | "cycleEndsAt" | "activeUntil">,
  rules: ActivityRules,
  now = new Date(),
): Promise<boolean> {
  if (affiliate.status !== "approved") return false;
  if (affiliate.activeUntil && affiliate.activeUntil > now) return true;
  if (!affiliate.cycleStartedAt) return false;
  return (await cycleProgress(affiliate, rules)).met;
}

/** Direct recruits who are currently active (what an upline needs 3 of). */
export async function activeRecruitsNow(affiliateId: string, rules: ActivityRules, now = new Date()) {
  const recruits = await prisma.affiliate.findMany({
    where: { parentAffiliateId: affiliateId, status: "approved" },
    select: { id: true, status: true, cycleStartedAt: true, cycleEndsAt: true, activeUntil: true },
  });
  let count = 0;
  for (const r of recruits) if (await isCurrentlyActive(r, rules, now)) count += 1;
  return count;
}

/**
 * Starts a fresh cycle. `grandfather` marks the affiliate active for the whole first cycle, used
 * for everyone who already existed when the program was switched on so overrides don't stop.
 */
export async function startCycle(
  affiliateId: string,
  rules: ActivityRules,
  opts: { grandfather: boolean; now?: Date },
) {
  const now = opts.now ?? new Date();
  const ends = new Date(now.getTime() + rules.cycleDays * DAY);
  return prisma.affiliate.update({
    where: { id: affiliateId },
    data: {
      cycleStartedAt: now,
      cycleEndsAt: ends,
      activeUntil: opts.grandfather ? ends : null,
      cycleWarningStage: 0,
    },
  });
}

/** For a newly approved or reactivated affiliate: begin their cycle if the program is on. */
export async function startCycleIfEnabled(affiliateId: string) {
  const rules = await getActivityRules();
  if (!rules.enabled) return null;
  return startCycle(affiliateId, rules, { grandfather: false });
}

/** Called when an admin turns the program on: everyone already approved starts a grandfathered cycle. */
export async function startCyclesForExisting(rules: ActivityRules, now = new Date()) {
  const rows = await prisma.affiliate.findMany({
    where: { status: "approved", cycleStartedAt: null },
    select: { id: true },
  });
  for (const r of rows) await startCycle(r.id, rules, { grandfather: true, now });
  return rows.length;
}

export interface CycleRunResult {
  initialized: number;
  rolledOver: number;
  suspended: number;
  warned: number;
  errors: string[];
}

/**
 * Daily job. Does nothing while the program is off. For every approved affiliate: starts a cycle if
 * they have none (grandfathered, so nobody is suspended by surprise), rolls a passed cycle over,
 * suspends a failed one, and sends the 14-day and 3-day warnings to those still short.
 */
export async function processActivityCycles(now = new Date(), opts: { sendEmail?: boolean } = {}): Promise<CycleRunResult> {
  const result: CycleRunResult = { initialized: 0, rolledOver: 0, suspended: 0, warned: 0, errors: [] };
  const rules = await getActivityRules();
  if (!rules.enabled) return result;
  const sendEmail = opts.sendEmail !== false;

  result.initialized = await startCyclesForExisting(rules, now);

  const due = await prisma.affiliate.findMany({
    where: { status: "approved", cycleEndsAt: { not: null } },
  });

  for (const a of due) {
    try {
      const ends = a.cycleEndsAt!;
      const progress = await cycleProgress(a, rules);

      if (ends <= now) {
        if (progress.met) {
          // Roll straight on from the old end (no drift); catch up if the job was late.
          let start = ends;
          let nextEnd = new Date(start.getTime() + rules.cycleDays * DAY);
          while (nextEnd <= now) {
            start = nextEnd;
            nextEnd = new Date(start.getTime() + rules.cycleDays * DAY);
          }
          await prisma.affiliate.update({
            where: { id: a.id },
            data: { cycleStartedAt: start, cycleEndsAt: nextEnd, activeUntil: nextEnd, cycleWarningStage: 0 },
          });
          result.rolledOver += 1;
          await createNotification(a.id, {
            type: "activity_passed",
            title: "You're active for another cycle",
            body: `You met this cycle's requirement. Your next cycle ends ${nextEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`,
          });
          if (sendEmail) await notifyActivityPassed(a, nextEnd);
        } else {
          await prisma.affiliate.update({
            where: { id: a.id },
            data: {
              status: "suspended",
              suspendReason: `Inactive: did not meet the ${rules.cycleDays}-day requirement.`,
              activeUntil: null,
            },
          });
          result.suspended += 1;
          await createNotification(a.id, {
            type: "activity_suspended",
            title: "Your account was suspended",
            body: "You didn't meet the activity requirement this cycle. Contact us to be reactivated.",
          });
          if (sendEmail) await notifyActivitySuspended(a, rules, progress);
        }
        continue;
      }

      if (progress.met) continue;
      const daysLeft = Math.ceil((ends.getTime() - now.getTime()) / DAY);
      // Warn once per threshold: stage 0 -> first, 1 -> second.
      const stage = a.cycleWarningStage;
      const due14 = stage < 1 && daysLeft <= WARNING_DAYS[0];
      const due3 = stage < 2 && daysLeft <= WARNING_DAYS[1];
      if (due14 || due3) {
        const nextStage = due3 ? 2 : 1;
        await prisma.affiliate.update({ where: { id: a.id }, data: { cycleWarningStage: nextStage } });
        result.warned += 1;
        await createNotification(a.id, {
          type: "activity_warning",
          title: `${daysLeft} days left to stay active`,
          body: `Recruit ${Math.max(rules.requiredRecruits - progress.recruits, 0)} more affiliate(s)${rules.minSales > 0 ? ` or reach $${rules.minSales.toLocaleString("en-US")} in sales` : ""} before your cycle ends.`,
        });
        if (sendEmail) await notifyActivityWarning(a, rules, progress, daysLeft);
      }
    } catch (err) {
      console.error("Activity cycle failed for", a.id, err);
      result.errors.push(`${a.userEmail}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return result;
}
