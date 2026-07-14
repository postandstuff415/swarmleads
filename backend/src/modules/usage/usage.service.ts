/**
 * Monthly lead allowance.
 *
 * Per-search caps only limit the blast radius of ONE query — they don't stop a
 * power user running hundreds of searches. This enforces an aggregate monthly
 * allowance per account, which is what actually protects the $29.99 margin.
 *
 * Usage is derived from the ScrapeJob rows already written by the bee chain, so
 * there is no separate counter to keep in sync (and no migration needed).
 */
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';

export interface MonthlyUsage {
  /** Leads actually delivered to the user this period. */
  leadsUsed: number;
  /** Leads allowed per period. */
  allowance: number;
  /** Leads still available (never negative). */
  remaining: number;
  /** Fraction of the allowance consumed, 0-1. */
  fraction: number;
  /** Provider spend this period, USD (for internal margin tracking). */
  costThisMonth: number;
  /** Max leads a single search can return — the UI sizes its slider to this. */
  perSearchCap: number;
  periodStart: string;
  /** When the allowance resets (start of next calendar month, UTC). */
  resetsAt: string;
}

/** Start of the current calendar month (UTC). */
function periodStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Start of the next calendar month (UTC) — when the allowance resets. */
function periodEnd(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export async function getMonthlyUsage(userId: string): Promise<MonthlyUsage> {
  const start = periodStart();

  const agg = await prisma.scrapeJob.aggregate({
    where: { userId, createdAt: { gte: start } },
    _sum: { leadsFound: true, outscraperCost: true },
  });

  const allowance = env.OUTSCRAPER_MONTHLY_LEAD_ALLOWANCE;
  const leadsUsed = agg._sum.leadsFound ?? 0;
  const remaining = Math.max(0, allowance - leadsUsed);

  return {
    leadsUsed,
    allowance,
    remaining,
    fraction: allowance > 0 ? Math.min(1, leadsUsed / allowance) : 0,
    costThisMonth: Number(agg._sum.outscraperCost ?? 0),
    perSearchCap: env.OUTSCRAPER_MAX_LEADS_PER_SEARCH,
    periodStart: start.toISOString(),
    resetsAt: periodEnd().toISOString(),
  };
}

/** Leads this user may still pull this period. */
export async function remainingAllowance(userId: string): Promise<number> {
  const { remaining } = await getMonthlyUsage(userId);
  return remaining;
}
