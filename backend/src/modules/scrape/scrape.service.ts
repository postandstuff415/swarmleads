/**
 * Orchestrates the bee chain: Scraper -> Strategist -> Writer.
 *
 * Each run is backed by a persisted ScrapeJob so the frontend can poll real
 * status/stage instead of faking progress. `startScrapeJob` creates the job and
 * kicks the chain off fire-and-forget (matching the prototype's semantics); the
 * chain updates the job as each bee finishes and records Outscraper usage/cost.
 */
import { prisma } from '../../lib/prisma.js';
import { scrapeLeads, type ScrapeInput } from './engines/scraper.engine.js';
import { runStrategist } from './engines/strategist.engine.js';
import { runWriter } from './engines/writer.engine.js';

/** Create the job row, start the chain in the background, return the job id. */
export async function startScrapeJob(input: Required<ScrapeInput>, userId: string): Promise<string> {
  const job = await prisma.scrapeJob.create({
    data: {
      industry: input.industry,
      region: input.region,
      target: input.target,
      status: 'QUEUED',
      stage: 'SCRAPER',
      userId,
    },
  });

  // Fire-and-forget; errors are captured onto the job, never thrown to caller.
  void runScrapeChain(input, job.id, userId);

  return job.id;
}

async function runScrapeChain(input: Required<ScrapeInput>, jobId: string, userId: string): Promise<void> {
  try {
    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', stage: 'SCRAPER' },
    });

    const scrape = await scrapeLeads(input, jobId, userId);
    console.log(
      `Scraper Bee completed: ${scrape.count} leads for ${input.industry} in ${input.region} ` +
        `(source=${scrape.source}, units=${scrape.units}, cost=$${scrape.cost})`,
    );
    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: {
        stage: 'STRATEGIST',
        leadsFound: scrape.count,
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
    await prisma.scrapeJob
      .update({
        where: { id: jobId },
        data: { status: 'FAILED', error: message, completedAt: new Date() },
      })
      .catch(() => {});
  }
}

/** Fetch a job's current status for polling (null if not found). */
export async function getScrapeJob(jobId: string) {
  return prisma.scrapeJob.findUnique({ where: { id: jobId } });
}

export { runStrategist, runWriter };
