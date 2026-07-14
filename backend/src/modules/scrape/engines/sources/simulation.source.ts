/**
 * Simulation lead source — the original prototype generator, now behind the
 * LeadSource interface. Used as the no-key fallback (and in tests) when
 * OUTSCRAPER_API_KEY is not configured. Produces deterministic-shaped fake
 * businesses; costs nothing.
 */
import {
  INDUSTRY_KEYWORDS,
  FIRST_NAMES,
  LAST_NAMES,
  ANGLES,
  BUSINESS_SUFFIXES,
} from '../templates.js';
import { randomItem, randomPhone, randomEmail, sleep } from '../../../../utils/random.js';
import type { LeadSource, ScrapeQuery, ScrapeResult, RawLead } from './lead-source.js';

function generateBusinessName(industry: string, region: string, index: number): string {
  const keywords = INDUSTRY_KEYWORDS[industry] ?? [industry];
  const kw = keywords[index % keywords.length];
  const pattern = index % 3;
  if (pattern === 0) return `${region} ${kw} ${randomItem(BUSINESS_SUFFIXES)}`;
  if (pattern === 1) return `${region} ${randomItem(BUSINESS_SUFFIXES)} ${kw}`;
  return `${kw} of ${region}`;
}

export const simulationSource: LeadSource = {
  name: 'scraper',

  async fetch({ industry, region, limit }: ScrapeQuery): Promise<ScrapeResult> {
    // Simulate scraping latency (1-3s), matching the prototype's feel.
    await sleep(1000 + Math.random() * 2000);

    const leads: RawLead[] = Array.from({ length: limit }, (_, i) => {
      const businessName = generateBusinessName(industry, region, i);
      const contactPerson = `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
      return {
        businessName,
        contactPerson,
        phone: randomPhone(),
        email: randomEmail(contactPerson, businessName),
        angle: randomItem(ANGLES),
      };
    });

    return { leads, source: 'scraper', units: 0, estimatedCostUsd: 0 };
  },
};
