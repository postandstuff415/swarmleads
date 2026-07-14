import type { Lead, LeadStatus } from '@prisma/client';

const STATUS_TO_JSON: Record<LeadStatus, string> = {
  NEW: 'new',
  VERIFIED: 'verified',
  HIGH_INTENT: 'high_intent',
};

export interface LeadDTO {
  id: string;
  business_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  industry: string;
  region: string;
  angle: string | null;
  source: string | null;
  status: string;
  outreach_script: string | null;
  website: string | null;
  rating: number | null;
  reviews: number | null;
  created_at: string;
  score: number;
}

/**
 * Deterministic lead score (0-100). When real Outscraper signals are present,
 * blend the Google rating and review volume; otherwise fall back to a stable
 * per-status band derived from the lead id (no more per-request randomness).
 */
function scoreFor(lead: Lead): number {
  if (lead.rating != null || lead.reviews != null) {
    const ratingPart = ((lead.rating ?? 0) / 5) * 70; // up to 70 pts from rating
    const reviewPart = Math.min((lead.reviews ?? 0) / 100, 1) * 30; // up to 30 pts
    return Math.max(1, Math.min(100, Math.round(ratingPart + reviewPart)));
  }
  // Stable pseudo-score for simulated leads: hash the id into the status band.
  const base = lead.status === 'HIGH_INTENT' ? 75 : lead.status === 'VERIFIED' ? 50 : 20;
  const span = lead.status === 'NEW' ? 30 : 25;
  let h = 0;
  for (const ch of lead.id) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  return base + (h % span);
}

/**
 * Map a Prisma Lead (camelCase) to the snake_case JSON shape the frontend
 * consumes, adding the per-lead `score`.
 */
export function toLeadDTO(lead: Lead): LeadDTO {
  return {
    id: lead.id,
    business_name: lead.businessName,
    contact_person: lead.contactPerson,
    phone: lead.phone,
    email: lead.email,
    industry: lead.industry,
    region: lead.region,
    angle: lead.angle,
    source: lead.source,
    status: STATUS_TO_JSON[lead.status],
    outreach_script: lead.outreachScript,
    website: lead.website,
    rating: lead.rating,
    reviews: lead.reviews,
    created_at: lead.createdAt.toISOString(),
    score: scoreFor(lead),
  };
}
