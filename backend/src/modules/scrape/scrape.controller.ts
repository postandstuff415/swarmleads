import type { Request, Response } from 'express';
import type { ScrapeBody } from './scrape.schema.js';
import { HttpError } from '../../lib/http-error.js';
import { getMonthlyUsage } from '../usage/usage.service.js';
import { startScrapeJob, getScrapeJob, runStrategist, runWriter } from './scrape.service.js';

const CHAIN = ['Scraper Bee', 'Strategist Bee', 'Writer Bee'];

/** POST /api/scrape — create a scrape job and deploy the bee chain. */
export async function scrape(req: Request, res: Response): Promise<void> {
  const { industry, region, target } = req.body as ScrapeBody;
  const userId = req.user!.userId;

  // Reject before creating a job if the monthly allowance is spent — a clear
  // 402 beats a job that immediately fails.
  const usage = await getMonthlyUsage(userId);
  if (usage.remaining <= 0) {
    throw new HttpError(
      402,
      `You've used all ${usage.allowance} leads in your monthly allowance. ` +
        `It resets on ${new Date(usage.resetsAt).toDateString()}.`,
    );
  }

  const jobId = await startScrapeJob({ industry, region, target }, userId);

  res.json({
    message: `Worker Bees deployed for ${industry} in ${region}`,
    jobId,
    industry,
    region,
    target,
    // The engine shrinks the search to fit what's left of the allowance.
    allowanceRemaining: usage.remaining,
    status: 'running',
    chain: CHAIN,
  });
}

/** GET /api/scrape/:jobId — real job status for the Command Center to poll. */
export async function scrapeStatus(req: Request, res: Response): Promise<void> {
  const jobId = String(req.params.jobId);
  const job = await getScrapeJob(jobId);
  if (!job || job.userId !== req.user!.userId) {
    throw new HttpError(404, 'Scrape job not found');
  }

  res.json({
    jobId: job.id,
    status: job.status,
    stage: job.stage,
    leadsFound: job.leadsFound,
    error: job.error,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  });
}

/** POST /api/strategize — run Strategist + Writer only (current user's leads). */
export async function strategize(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const strategist = await runStrategist(userId);
  const writer = await runWriter(userId);
  res.json({ strategist, writer });
}

/** POST /api/write — run Writer only (current user's leads). */
export async function write(req: Request, res: Response): Promise<void> {
  const result = await runWriter(req.user!.userId);
  res.json(result);
}
