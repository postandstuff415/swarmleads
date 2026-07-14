/**
 * Outscraper lead source — live Google Maps business data.
 *
 * Calls Outscraper's Google Maps Search API, maps records to the RawLead shape
 * (name, phone, website, rating, reviews, optional email enrichment), and
 * reports usage so the job can log cost. Retries transient failures and polls
 * the async results endpoint when the request isn't answered synchronously.
 *
 * Docs: https://app.outscraper.com/api-docs#tag/Google-Maps
 */
import { env } from '../../../../config/env.js';
import { HttpError } from '../../../../lib/http-error.js';
import { sleep } from '../../../../utils/random.js';
import type { LeadSource, ScrapeQuery, ScrapeResult, RawLead } from './lead-source.js';

const BASE_URL = 'https://api.app.outscraper.com';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const POLL_INTERVAL_MS = 3_000;
const MAX_POLLS = 40; // ~2 min ceiling on async result polling

/** One business record as returned by the Outscraper Maps API (subset we use). */
interface OutscraperPlace {
  name?: string;
  phone?: string;
  site?: string;
  email_1?: string;
  emails?: string[] | string;
  rating?: number;
  reviews?: number;
  type?: string;
}

interface OutscraperResponse {
  id?: string;
  status?: string; // "Success" | "Pending" | "Error"
  data?: unknown;
  results_location?: string;
}

function apiKey(): string {
  const key = env.OUTSCRAPER_API_KEY;
  if (!key) {
    throw new HttpError(500, 'OUTSCRAPER_API_KEY is not configured');
  }
  return key;
}

async function outscraperGet(path: string): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    headers: { 'X-API-KEY': apiKey() },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

/** GET with small exponential backoff on network / 5xx / 429 errors. */
async function getWithRetry(path: string): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await outscraperGet(path);
      if (res.status >= 500 || res.status === 429) {
        lastErr = new Error(`Outscraper responded ${res.status}`);
      } else {
        return res;
      }
    } catch (err) {
      lastErr = err;
    }
    if (attempt < MAX_RETRIES) await sleep(500 * 2 ** (attempt - 1));
  }
  throw new HttpError(
    502,
    `Outscraper request failed after ${MAX_RETRIES} attempts: ${(lastErr as Error)?.message ?? 'unknown error'}`,
  );
}

/** Normalize the API payload into a flat list of place records. */
function extractPlaces(data: unknown): OutscraperPlace[] {
  if (!Array.isArray(data)) return [];
  // Maps search returns one result array per query; we send a single query.
  const first = data[0];
  const rows = Array.isArray(first) ? first : data;
  return rows.filter((r): r is OutscraperPlace => !!r && typeof r === 'object');
}

/** Poll the async results endpoint until the request reaches a terminal state. */
async function pollResults(requestId: string): Promise<OutscraperPlace[]> {
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const res = await getWithRetry(`/requests/${requestId}`);
    const body = (await res.json()) as OutscraperResponse;
    if (body.status === 'Success') return extractPlaces(body.data);
    if (body.status === 'Error') {
      throw new HttpError(502, 'Outscraper reported an error processing the request');
    }
  }
  throw new HttpError(504, 'Outscraper request timed out while polling for results');
}

function firstEmail(place: OutscraperPlace): string | null {
  if (place.email_1) return place.email_1;
  if (Array.isArray(place.emails)) return place.emails[0] ?? null;
  if (typeof place.emails === 'string') return place.emails || null;
  return null;
}

function toRawLead(place: OutscraperPlace): RawLead | null {
  if (!place.name) return null;
  return {
    businessName: place.name,
    contactPerson: null, // Maps data rarely includes a contact name.
    phone: place.phone ?? null,
    email: firstEmail(place),
    website: place.site ?? null,
    rating: typeof place.rating === 'number' ? place.rating : null,
    reviews: typeof place.reviews === 'number' ? place.reviews : null,
    angle: null, // Strategist assigns the angle downstream.
  };
}

export const outscraperSource: LeadSource = {
  name: 'outscraper',

  async fetch({ industry, region, limit }: ScrapeQuery): Promise<ScrapeResult> {
    const query = encodeURIComponent(`${industry} in ${region}`);
    const path =
      `/maps/search-v3?query=${query}&limit=${limit}` +
      `&language=en&region=US&async=false`;

    const res = await getWithRetry(path);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new HttpError(502, `Outscraper search failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const body = (await res.json()) as OutscraperResponse;
    let places: OutscraperPlace[];
    if (body.status === 'Success') {
      places = extractPlaces(body.data);
    } else if (body.id) {
      // Request was accepted asynchronously — poll until it finishes.
      places = await pollResults(body.id);
    } else {
      places = extractPlaces(body.data);
    }

    const leads = places
      .slice(0, limit)
      .map(toRawLead)
      .filter((l): l is RawLead => l !== null);

    const units = leads.length;
    const estimatedCostUsd = Number((units * env.OUTSCRAPER_COST_PER_LEAD_USD).toFixed(4));

    return { leads, source: 'outscraper', units, estimatedCostUsd };
  },
};
