import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Outscraper (live lead source). When unset, the scraper falls back to the
  // built-in simulation source.
  OUTSCRAPER_API_KEY: z.string().min(1).optional(),
  OUTSCRAPER_MAX_LEADS_PER_SEARCH: z.coerce.number().int().positive().max(500).default(50),
  // Monthly lead allowance per account. Protects the $29.99 margin against
  // aggregate usage (per-search caps only limit one query's blast radius).
  OUTSCRAPER_MONTHLY_LEAD_ALLOWANCE: z.coerce.number().int().positive().default(1000),
  // Optional hard cost cap per search (USD). Runs projected to exceed it fail fast.
  OUTSCRAPER_COST_CAP_USD: z.coerce.number().positive().optional(),
  // Estimated Outscraper price per returned record (USD), used for cost logging.
  OUTSCRAPER_COST_PER_LEAD_USD: z.coerce.number().positive().default(0.002),

  // Cross-app bridge (SwarmLeads -> BounceBack). Secret must match BounceBack's
  // SWARMLEADS_BRIDGE_JWT_SECRET. Optional so the API boots without the bridge.
  SWARMLEADS_BRIDGE_JWT_SECRET: z.string().min(16).optional(),
  BOUNCEBACK_API_URL: z.string().url().optional(),

  // Public base URL of the SwarmLeads frontend (used to build the login callback
  // returnTo and Stripe success/cancel URLs).
  SWARMLEADS_APP_URL: z.string().url().default('http://localhost:3000'),
  // Secret for signing SwarmLeads' own session JWTs (independent of the bridge).
  SWARMLEADS_SESSION_SECRET: z.string().min(16).optional(),

  // Gate paid features (scrape / export / push) behind an active subscription.
  // Defaults ON — leaving it off means anyone with a BounceBack login can spend
  // our Outscraper budget for free. Set to false only for local demos.
  REQUIRE_SUBSCRIPTION: z
    .string()
    .optional()
    .transform((v) => v !== 'false')
    .pipe(z.boolean()),

  // Stripe ($29.99/mo SwarmLeads subscription). Optional — stubbed when unset.
  STRIPE_API_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  SWARMLEADS_SUB_PRICE_CENTS: z.coerce.number().int().positive().default(2999),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
