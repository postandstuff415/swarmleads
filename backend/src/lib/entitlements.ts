/**
 * Per-product entitlement, derived from Stripe (the source of truth).
 *
 * BounceBack and SwarmLeads share ONE Stripe customer, so a customer can hold
 * subscriptions to both products. Never infer entitlement from a single webhook
 * event keyed on the customer — that's what made cancelling one product
 * deactivate the other. Recompute the whole picture from Stripe instead:
 * idempotent, order-independent, and self-healing if a webhook is missed.
 *
 * Mirrors bounceback-sms/src/lib/entitlements.ts — keep the two in sync.
 */
import type Stripe from 'stripe';
import { LOOKUP_KEYS, priceIdByLookupKey, type App } from './pricing.js';

export type Entitlement = 'active' | 'trialing' | 'past_due' | 'inactive';

export interface Entitlements {
  bounceback: Entitlement;
  swarmleads: Entitlement;
}

/** Statuses that grant the customer access to the product. */
export function grantsAccess(e: Entitlement): boolean {
  return e === 'active' || e === 'trialing';
}

/**
 * `trialing` MUST count — onboarding uses a 14-day trial, so a brand-new paying
 * customer is `trialing`, not `active`. Treating them as "no product" charged
 * them the $29.99 standalone rate for their second product instead of $9.99.
 */
function normalize(status: Stripe.Subscription.Status): Entitlement | null {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    // canceled / unpaid / incomplete / incomplete_expired / paused => none
    default:
      return null;
  }
}

const RANK: Record<Entitlement, number> = { active: 3, trialing: 2, past_due: 1, inactive: 0 };

/** The 4 catalog price ids, used as a fallback classifier. */
async function catalogPriceIds(stripe: Stripe): Promise<Map<string, App>> {
  const map = new Map<string, App>();
  for (const app of ['bounceback', 'swarmleads'] as const) {
    for (const key of [LOOKUP_KEYS[app].standalone, LOOKUP_KEYS[app].addon]) {
      map.set(await priceIdByLookupKey(stripe, key), app);
    }
  }
  return map;
}

/** price id -> app, memoised. Prices are immutable, so this never goes stale. */
const priceAppCache = new Map<string, App | null>();

/**
 * Classify a LEGACY product by name.
 *
 * Products auto-created by Stripe from inline `price_data` are immutable —
 * Stripe rejects metadata writes on them ("created by Stripe automatically and
 * cannot be updated"), so they can never be tagged. These names are the exact
 * strings our own pre-catalog checkout code emitted, so the set is known and
 * bounded.
 *
 * Order matters: "SwarmLeads BounceBack Add-on" sells BOUNCEBACK service to a
 * SwarmLeads user, so `bounceback` must win over the `swarmleads` substring.
 */
function appForLegacyProductName(name: string | undefined): App | null {
  const n = (name ?? '').toLowerCase();
  if (n.includes('bounceback')) return 'bounceback';
  if (n.includes('swarmleads')) return 'swarmleads';
  return null;
}

/**
 * Which app does this price belong to?
 *
 * Subscriptions created before the price catalog existed use ad-hoc inline
 * prices — no `lookup_key`, on an auto-created product. Classifying purely by
 * the 4 catalog price ids made every one of those subscriptions invisible, so
 * real customers appeared to own nothing and were quoted the $29.99 standalone
 * rate for their second product instead of the $9.99 add-on.
 *
 * So we classify by the price's PRODUCT metadata (which we backfill onto legacy
 * products), and keep the catalog ids as a fallback.
 *
 * Note: we must retrieve prices individually with `expand: ["product"]` —
 * `subscriptions.list` cannot expand `data.items.data.price.product` (Stripe
 * caps expansion at 4 levels).
 */
async function appForPrice(
  stripe: Stripe,
  priceId: string,
  catalog: Map<string, App>,
): Promise<App | null> {
  const cached = priceAppCache.get(priceId);
  if (cached !== undefined) return cached;

  let app: App | null = catalog.get(priceId) ?? null;

  if (!app) {
    try {
      const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
      const product = price.product as Stripe.Product;

      // Preferred: an explicit tag on a product we control.
      const tag = product?.metadata?.app;
      if (tag === 'bounceback' || tag === 'swarmleads') {
        app = tag;
      } else {
        // Legacy: Stripe-auto-created products are immutable and can never be
        // tagged, so fall back to their (known) name.
        app = appForLegacyProductName(product?.name);
      }
    } catch (err) {
      console.warn(`[Entitlements] Could not retrieve price ${priceId}: ${(err as Error).message}`);
    }
  }

  if (!app) {
    // Never fail silently — an unclassifiable price means someone is paying for
    // something we don't recognise, which is exactly how the double-billing hid.
    console.warn(`[Entitlements] Unclassified price ${priceId} — tag its product with metadata.app`);
  }

  priceAppCache.set(priceId, app);
  return app;
}

/** Fold one customer's subscriptions into the entitlement result. */
async function foldSubscriptions(
  stripe: Stripe,
  subs: Stripe.Subscription[],
  catalog: Map<string, App>,
  result: Entitlements,
): Promise<void> {
  for (const sub of subs) {
    const entitlement = normalize(sub.status);
    if (!entitlement) continue;
    for (const item of sub.items.data) {
      const app = await appForPrice(stripe, item.price.id, catalog);
      if (!app) continue;
      if (RANK[entitlement] > RANK[result[app]]) result[app] = entitlement;
    }
  }
}

/** What this customer is entitled to, per product, straight from Stripe. */
export async function computeEntitlements(stripe: Stripe, customerId: string): Promise<Entitlements> {
  const result: Entitlements = { bounceback: 'inactive', swarmleads: 'inactive' };
  const [catalog, subs] = await Promise.all([
    catalogPriceIds(stripe),
    stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 }),
  ]);
  await foldSubscriptions(stripe, subs.data, catalog, result);
  return result;
}

/**
 * What this EMAIL is entitled to, unioned across every Stripe customer holding
 * it. The old checkout minted a fresh Customer per session, so one email can own
 * several customers; reading only the first one missed the subscription that
 * actually mattered.
 */
export async function computeEntitlementsForEmail(
  stripe: Stripe,
  email: string,
): Promise<Entitlements> {
  const result: Entitlements = { bounceback: 'inactive', swarmleads: 'inactive' };

  const [catalog, customers] = await Promise.all([
    catalogPriceIds(stripe),
    stripe.customers.list({ email: email.toLowerCase(), limit: 100 }),
  ]);

  for (const customer of customers.data) {
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 100,
    });
    await foldSubscriptions(stripe, subs.data, catalog, result);
  }

  return result;
}
