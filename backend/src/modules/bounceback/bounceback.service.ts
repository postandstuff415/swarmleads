/**
 * BounceBack module. Real missed-call/SMS activity + add-on status/checkout are
 * read through the cross-app bridge; the local template simulation is retained
 * as a fallback when the bridge isn't configured (dev without BounceBack).
 */
import type { BouncebackLog } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { randomItem } from '../../utils/random.js';
import { BOUNCEBACK_TEMPLATES, SAMPLE_INCOMING } from '../scrape/engines/templates.js';
import {
  getBounceBackActivity,
  getBounceBackAddonStatus,
  startAddonCheckout,
} from '../../lib/bridge-client.js';
import { getStripe, isStripeConfigured } from '../../lib/stripe.js';
import { resolvePriceFor } from '../../lib/pricing.js';
import type { BouncebackSimulateBody } from './bounceback.schema.js';

/** True when the SwarmLeads->BounceBack bridge is configured. */
function bridgeReady(): boolean {
  return !!env.BOUNCEBACK_API_URL && !!env.SWARMLEADS_BRIDGE_JWT_SECRET;
}

export interface BouncebackLogDTO {
  id: string;
  incoming_number: string | null;
  outgoing_text: string | null;
  industry: string | null;
  region: string | null;
  status: string;
  created_at: string;
}

function toDTO(log: BouncebackLog): BouncebackLogDTO {
  return {
    id: log.id,
    incoming_number: log.incomingNumber,
    outgoing_text: log.outgoingText,
    industry: log.industry,
    region: log.region,
    status: log.status,
    created_at: log.createdAt.toISOString(),
  };
}

export async function simulateBounceBack(input: BouncebackSimulateBody): Promise<BouncebackLogDTO> {
  const { incomingNumber, industry, region, businessName } = input;

  const outgoingText = randomItem(BOUNCEBACK_TEMPLATES)
    .replace(/{industry}/g, industry || 'your industry')
    .replace(/{region}/g, region || 'your area')
    .replace(/{business_name}/g, businessName || 'our team');

  const log = await prisma.bouncebackLog.create({
    data: {
      incomingNumber: incomingNumber || randomItem(SAMPLE_INCOMING),
      outgoingText,
      industry: industry || '',
      region: region || '',
      status: 'sent',
    },
  });

  return toDTO(log);
}

/**
 * Real BounceBack call/SMS activity for a user via the bridge, mapped to the
 * frontend's log shape. Falls back to the local simulation when the bridge
 * isn't configured (or the call fails).
 */
export async function getActivity(email: string): Promise<BouncebackLogDTO[]> {
  if (!bridgeReady()) {
    const logs = await prisma.bouncebackLog.findMany({ orderBy: { createdAt: 'desc' } });
    return logs.map(toDTO);
  }
  const activity = await getBounceBackActivity(email);
  return activity.map((a) => ({
    id: a.id,
    incoming_number: a.callerNumber,
    outgoing_text: a.smsSent ? 'Auto-text sent to missed caller' : null,
    industry: null,
    region: null,
    status: a.callStatus,
    created_at: a.timestamp,
  }));
}

export interface AddonStatus {
  addonActive: boolean;
  /**
   * The price this user would ACTUALLY pay to add BounceBack right now. It is
   * the $9.99 add-on rate only if they already hold an active SwarmLeads
   * subscription; otherwise BounceBack is their first product at $29.99. The
   * banner must render this rather than hardcoding $9.99, or we'd advertise one
   * price and charge another.
   */
  price: { tier: 'standalone' | 'addon'; amount: number } | null;
}

/** Add-on entitlement + the real price this user would be charged. */
export async function getAddonStatus(email: string): Promise<AddonStatus> {
  if (!bridgeReady()) return { addonActive: false, price: null };

  const { addonActive } = await getBounceBackAddonStatus(email);

  let price: AddonStatus['price'] = null;
  if (isStripeConfigured()) {
    try {
      const stripe = getStripe();
      const { tier, priceId } = await resolvePriceFor(stripe, 'bounceback', { email });
      const p = await stripe.prices.retrieve(priceId);
      price = { tier, amount: (p.unit_amount ?? 0) / 100 };
    } catch (err) {
      // Never block the dashboard on a pricing lookup; the banner just hides the price.
      console.error('Add-on price lookup failed:', (err as Error).message);
    }
  }

  return { addonActive, price };
}

/** Start the BounceBack add-on checkout (via bridge). */
export async function startAddonCheckoutForUser(email: string): Promise<{ url: string; stubbed?: boolean }> {
  return startAddonCheckout(email);
}
