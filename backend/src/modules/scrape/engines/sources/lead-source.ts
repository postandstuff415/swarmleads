/**
 * LeadSource — the abstraction the Scraper Bee fetches through.
 *
 * The engine stays identical regardless of whether leads come from the live
 * Outscraper Google Maps API or the built-in simulation. A source only fetches
 * and normalizes raw business records; persistence, status, and job wiring are
 * the engine's job (see scraper.engine.ts).
 */

export interface ScrapeQuery {
  industry: string;
  region: string;
  /** Max records to return — already clamped to the per-search cap by the engine. */
  limit: number;
}

/** A normalized business record, before it becomes a `Lead` row. */
export interface RawLead {
  businessName: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  /** Google rating (0-5) and review count — high-intent signals when present. */
  rating?: number | null;
  reviews?: number | null;
  /** Free-form outreach angle; the Strategist may refine it later. */
  angle?: string | null;
}

export interface ScrapeResult {
  leads: RawLead[];
  /** Source identifier persisted on each Lead (`source` column). */
  source: string;
  /** Billable records consumed from the provider (0 for the simulation). */
  units: number;
  /** Estimated provider cost in USD for this fetch (0 for the simulation). */
  estimatedCostUsd: number;
}

export interface LeadSource {
  readonly name: string;
  fetch(query: ScrapeQuery): Promise<ScrapeResult>;
}
