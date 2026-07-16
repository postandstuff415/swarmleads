/**
 * Orchestrates the bee chain: Scraper -> Strategist -> Writer.
 *
 * Each run is backed by a persisted ScrapeJob so the frontend can poll real
 * status/stage instead of faking progress. `startScrapeJob` creates the job and
 * kicks the chain off fire-and-forget (matching the prototype's semantics); the
 * chain updates the job as each bee finishes and records Outscraper usage/cost.
 */
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/http-error.js';
import { currentPeriodStart } from '../usage/usage.service.js';
import { scrapeLeads, type ScrapeInput } from './engines/scraper.engine.js';
import { runStrategist } from './engines/strategist.engine.js';
import { runWriter } from './engines/writer.engine.js';

/**
 * Create the job row and start the chain, reserving allowance atomically.
 *
 * The reservation prevents a TOCTOU race: usage is a SUM of `leadsFound`, which
 * is only written when a scrape finishes. Without reserving, N concurrent scrapes
 * all read the same stale sum and each pull a full quota's worth. We therefore
 * create the job with `leadsFound` pre-set to the reserved amount inside a
 * per-user–serialized transaction, so a concurrent request sees this reservation
 * in its own sum. The chain later reconciles `leadsFound` down to the true count.
 */
export async function startScrapeJob(input: Required<ScrapeInput>, userId: string): Promise<string> {
  const { jobId, reserved } = await prisma.$transaction(async (tx) => {
    // Serialize reservations for this user (released when the tx commits), so the
    // sum-then-insert below can't interleave with a concurrent scrape's.
    // Use $executeRaw — pg_advisory_xact_lock returns void, which $queryRaw
    // cannot deserialize.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const agg = await tx.scrapeJob.aggregate({
      where: { userId, createdAt: { gte: currentPeriodStart() } },
      _sum: { leadsFound: true },
    });
    const used = agg._sum.leadsFound ?? 0;
    const remaining = Math.max(0, env.OUTSCRAPER_MONTHLY_LEAD_ALLOWANCE - used);

    if (remaining <= 0) {
      throw new HttpError(
        402,
        `You've used all ${env.OUTSCRAPER_MONTHLY_LEAD_ALLOWANCE} leads in your monthly allowance.`,
      );
    }

    const reserved = Math.min(input.target, env.OUTSCRAPER_MAX_LEADS_PER_SEARCH, remaining);

    const job = await tx.scrapeJob.create({
      data: {
        industry: input.industry,
        region: input.region,
        target: input.target,
        status: 'QUEUED',
        stage: 'SCRAPER',
        userId,
        leadsFound: reserved, // reservation — reconciled to the real count later
      },
    });

    return { jobId: job.id, reserved };
  });

  // Fire-and-forget; errors are captured onto the job, never thrown to caller.
  void runScrapeChain(input, jobId, userId, reserved);

  return jobId;
}

async function runScrapeChain(
  input: Required<ScrapeInput>,
  jobId: string,
  userId: string,
  reserved: number,
): Promise<void> {
  // The reservation is currently counted against the allowance; `delivered`
  // tracks how many leads were actually pulled so we can reconcile it.
  let delivered = 0;
  try {
    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', stage: 'SCRAPER' },
    });

    const scrape = await scrapeLeads(input, jobId, userId, reserved);
    delivered = scrape.count;
    console.log(
      `Scraper Bee completed: ${scrape.count} leads for ${input.industry} in ${input.region} ` +
        `(source=${scrape.source}, units=${scrape.units}, cost=$${scrape.cost})`,
    );
    // Reconcile the reservation down to the true count.
    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: {
        stage: 'STRATEGIST',
        leadsFound: delivered,
        outscraperUnits: scrape.units,
        outscraperCost: scrape.cost,
      },
    });

    const strat = await runStrategist(userId);
    console.log(strat.message);
    await prisma.scrapeJob.update({ where: { id: jobId }, data: { stage: 'WRITER' } });

    const writer = await runWriter(userId);
    console.log(writer.message);

    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: { stage: 'DONE', status: 'SUCCEEDED', completedAt: new Date() },
    });
  } catch (err) {
    const message = (err as Error).message;
    console.error('Bee chain error:', message);
    // Release the unused part of the reservation — a failed job must not
    // permanently consume the allowance. `delivered` is 0 if the scraper never
    // completed, or the real count if it failed later in the chain.
    await prisma.scrapeJob
      .update({
        where: { id: jobId },
        data: { status: 'FAILED', error: message, leadsFound: delivered, completedAt: new Date() },
      })
      .catch(() => {});
  }
}

/** Fetch a job's current status for polling (null if not found). */
export async function getScrapeJob(jobId: string) {
  return prisma.scrapeJob.findUnique({ where: { id: jobId } });
}

export { runStrategist, runWriter };
