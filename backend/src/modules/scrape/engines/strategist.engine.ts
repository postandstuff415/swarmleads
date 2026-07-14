/**
 * Strategist Bee — verifies NEW leads, refines the outreach angle, and sets
 * status to VERIFIED or HIGH_INTENT. Ported 1:1 from server/strategist-bee.mjs
 * (same verification/high-intent heuristics), persisting via Prisma.
 */
import type { Lead } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { STRATEGIES } from './templates.js';

/** Count the digits in a phone string (handles "+1 512-640-2658", "(510) 555-0199"). */
function digitCount(phone: string | null): number {
  return phone ? phone.replace(/\D/g, '').length : 0;
}

// Verification: a lead is real/usable if it has a plausible business name and a
// dialable phone. This holds for BOTH real Outscraper leads (no contact/email)
// and simulated leads — the earlier contact+email checks silently rejected all
// real Google Maps leads.
function isVerified(lead: Lead): boolean {
  const hasName = !!lead.businessName && lead.businessName.trim().length > 3;
  const hasPhone = digitCount(lead.phone) >= 10;
  return hasName && hasPhone;
}

// High-intent: prefer real Outscraper signals (strong rating + review volume, or
// an existing web presence). Fall back to the original keyword/name heuristics so
// simulated leads (which carry no rating/website) still promote.
const HIGH_INTENT_CHECKS: Array<(lead: Lead) => boolean> = [
  (lead) => (lead.rating ?? 0) >= 4.0 && (lead.reviews ?? 0) >= 10,
  (lead) => !!lead.website && lead.website.trim().length > 0,
  (lead) => /Pro(s|fessionals)?$|Experts$|Services$|Solutions$/.test(lead.businessName),
  (lead) => !!lead.angle && /emergency|same.day|24.?7|urgent|immediate/i.test(lead.angle),
  (lead) =>
    !!lead.businessName &&
    !!lead.region &&
    lead.businessName.toLowerCase().includes(lead.region.toLowerCase().split(',')[0].toLowerCase()),
];

function generateRefinedAngle(lead: Lead): string {
  const strategies = STRATEGIES[lead.industry];
  if (!strategies || strategies.length === 0) return lead.angle ?? '';
  const hash = lead.businessName.length + lead.region.length;
  const strategy = strategies[hash % strategies.length];
  const regionShort = lead.region.split(',')[0].trim();
  return strategy.replace(/{region}/g, regionShort);
}

function isHighIntent(lead: Lead): boolean {
  if (!isVerified(lead)) return false;
  return HIGH_INTENT_CHECKS.some((check) => check(lead));
}

export interface StrategistResult {
  processed: number;
  verified: number;
  highIntent: number;
  errors: number;
  message: string;
}

export async function runStrategist(userId?: string): Promise<StrategistResult> {
  const newLeads = await prisma.lead.findMany({
    where: { status: 'NEW', ...(userId ? { userId } : {}) },
  });

  if (newLeads.length === 0) {
    return { processed: 0, verified: 0, highIntent: 0, errors: 0, message: 'No new leads to analyze' };
  }

  let verified = 0;
  let highIntent = 0;
  let errors = 0;

  for (const lead of newLeads) {
    try {
      const refinedAngle = generateRefinedAngle(lead);
      const status = isHighIntent(lead) ? 'HIGH_INTENT' : isVerified(lead) ? 'VERIFIED' : 'NEW';

      if (status === 'VERIFIED') verified++;
      if (status === 'HIGH_INTENT') highIntent++;

      await prisma.lead.update({
        where: { id: lead.id },
        data: { angle: refinedAngle, status },
      });
    } catch (err) {
      console.error(`Strategist Bee error on lead ${lead.id}:`, (err as Error).message);
      errors++;
    }
  }

  return {
    processed: newLeads.length,
    verified,
    highIntent,
    errors,
    message: `Strategist Bee analyzed ${newLeads.length} leads: ${verified} verified, ${highIntent} high-intent`,
  };
}
