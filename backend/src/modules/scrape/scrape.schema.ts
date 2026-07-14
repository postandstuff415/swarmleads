import { z } from 'zod';
import { env } from '../../config/env.js';
import { VALID_INDUSTRIES } from './engines/templates.js';

const PER_SEARCH_CAP = env.OUTSCRAPER_MAX_LEADS_PER_SEARCH;

export const scrapeSchema = z.object({
  industry: z.enum(VALID_INDUSTRIES, {
    message: `industry must be one of: ${VALID_INDUSTRIES.join(', ')}`,
  }),
  region: z.string().trim().min(1, 'region is required'),
  // Asking for more than the per-search cap is a hard 400, not a silent trim —
  // callers should never think they're getting 500 leads and quietly receive 50.
  // (A user's remaining monthly allowance can still shrink the run below this,
  // but that IS surfaced: see `allowanceRemaining` on the scrape response.)
  target: z.coerce
    .number()
    .int()
    .min(1)
    .max(PER_SEARCH_CAP, `target cannot exceed ${PER_SEARCH_CAP} leads per search`)
    .optional()
    .default(PER_SEARCH_CAP),
});

export type ScrapeBody = z.infer<typeof scrapeSchema>;
