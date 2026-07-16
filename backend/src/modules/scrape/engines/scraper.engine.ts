/**
 * Scraper Bee — fetches leads for an industry + region through a LeadSource,
 * persists them with status NEW, and reports usage/cost back to the caller.
 *
 * The source is Outscraper (live Google Maps data) when OUTSCRAPER_API_KEY is
 * set, otherwise the built-in simulation. Persistence is unchanged (Prisma
 * createMany); the difference from the prototype is real data + cost logging.
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '../../../lib/prisma.js';
import { HttpError } from '../../../lib/http-error.js';
import { env } from '../../../config/env.js';
import { VALID_INDUSTRIES } from './templates.js';
import { simulationSource } from './sources/simulation.source.js';
import { outscraperSource } from './sources/outscraper.source.js';
import type { LeadSource } from './sources/lead-source.js';

export interface ScrapeInput {
  industry: string;
  region: string;
  target?: number;
}

/** Result of one scrape, surfaced to the job orchestrator for status/cost. */
export interface ScrapeOutcome {
  count: number;
  source: string;
  units: number;
  cost: number;
}

/** Pick the live source when a key is present, else fall back to simulation. */
function selectSource(): LeadSource {
  return env.OUTSCRAPER_API_KEY ? outscraperSource : simulationSource;
}

/**
 * Scrape leads for a given industry and region, persist them (optionally tagged
 * with a scrapeJobId), and return the count + provider usage.
 */
export async function scrapeLeads(
  { industry, region, target = 50 }: ScrapeInput,
  scrapeJobId?: string,
  userId?: string,
  maxLeads = Number.POSITIVE_INFINITY,
): Promise<ScrapeOutcome> {
  if (!VALID_INDUSTRIES.includes(industry)) {
    throw new HttpError(
      400,
      `Invalid industry. Must be one of: ${VALID_INDUSTRIES.join(', ')}`,
    );
  }

  // Two caps stack: the per-search ceiling bounds any single query, and
  // `maxLeads` is the allowance already RESERVED for this job by startScrapeJob
  // (which serializes the reservation to avoid a TOCTOU race). We never re-read
  // the allowance here — that would double-count this job's own reservation.
  const limit = Math.min(target, env.OUTSCRAPER_MAX_LEADS_PER_SEARCH, maxLeads);

  const source = selectSource();

  // Cost-cap pre-flight (live source only): fail fast before spending money.
  if (source.name === 'outscraper' && env.OUTSCRAPER_COST_CAP_USD !== undefined) {
    const projected = limit * env.OUTSCRAPER_COST_PER_LEAD_USD;
    if (projected > env.OUTSCRAPER_COST_CAP_USD) {
      throw new HttpError(
        400,
        `Projected scrape cost $${projected.toFixed(4)} exceeds cap $${env.OUTSCRAPER_COST_CAP_USD}`,
      );
    }
  }

  const result = await source.fetch({ industry, region, limit });

  const rows = result.leads.map((lead) => ({
    id: randomUUID(),
    businessName: lead.businessName,
    contactPerson: lead.contactPerson ?? null,
    phone: lead.phone ?? null,
    email: lead.email ?? null,
    industry,
    region,
    angle: lead.angle ?? null,
    source: result.source,
    status: 'NEW' as const,
    website: lead.website ?? null,
    rating: lead.rating ?? null,
    reviews: lead.reviews ?? null,
    scrapeJobId: scrapeJobId ?? null,
    userId: userId ?? null,
  }));

  if (rows.length > 0) {
    await prisma.lead.createMany({ data: rows });
  }

  return {
    count: rows.length,
    source: result.source,
    units: result.units,
    cost: result.estimatedCostUsd,
  };
}
