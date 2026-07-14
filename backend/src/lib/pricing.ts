/**
 * Cross-product pricing. BounceBack and SwarmLeads share ONE Stripe account, so
 * whichever product a customer buys first is $29.99/mo (standalone) and adding
 * the other later is $9.99/mo (add-on) — a $39.98/mo bundle.
 *
 * Prices resolve by `lookup_key`, so the same code works in test and live mode.
 * Mirrors bounceback-sms/src/lib/pricing.ts — keep the lookup keys in sync.
 */
import type Stripe from 'stripe';

export type App = 'bounceback' | 'swarmleads';

export const LOOKUP_KEYS: Record<App, { standalone: string; addon: string }> = {
  bounceback: {
    standalone: 'bounceback_standalone_monthly', // $29.99
    addon: 'bounceback_addon_monthly', // $9.99
  },
  swarmleads: {
    standalone: 'swarmleads_standalone_monthly', // $29.99
    addon: 'swarmleads_addon_monthly', // $9.99
  },
};

const priceCache = new Map<string, string>();

/** Resolve a Stripe Price id from its stable lookup_key. */
export async function priceIdByLookupKey(stripe: Stripe, lookupKey: string): Promise<string> {
  const cached = priceCache.get(lookupKey);
  if (cached) return cached;

  const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const price = data[0];
  if (!price) {
    throw new Error(
      `Stripe price with lookup_key "${lookupKey}" not found. Run the pricing setup script for this Stripe account.`,
    );
  }
  priceCache.set(lookupKey, price.id);
  return price.id;
}

/**
 * Every Stripe customer holding this email. The old checkout minted a fresh
 * Customer per session, so one email can legitimately own several — reading
 * only the first (limit: 1) missed the one that actually held the subscription.
 */
export async function findCustomerIdsByEmail(stripe: Stripe, email: string): Promise<string[]> {
  const { data } = await stripe.customers.list({ email: email.toLowerCase(), limit: 100 });
  return data.map((c) => c.id);
}

/**
 * The customer we should BILL against for this email. Prefer one that already
 * holds a subscription so we don't strand charges on an empty duplicate; else
 * the oldest. Returns null if the email has no customer yet.
 */
export async function findCustomerIdByEmail(stripe: Stripe, email: string): Promise<string | null> {
  const { data } = await stripe.customers.list({ email: email.toLowerCase(), limit: 100 });
  if (data.length === 0) return null;
  if (data.length === 1) return data[0].id;

  for (const customer of data) {
    const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 1 });
    if (subs.data.length > 0) return customer.id;
  }
  // Stripe lists newest-first; fall back to the oldest so we stay stable.
  return data[data.length - 1].id;
}

/**
 * Does this customer already hold the given app?
 *
 * Counts `trialing` and `past_due`, not just `active` — see entitlements.ts.
 * Checking only `active` overcharged trialing customers $20/mo on their second
 * product.
 */
export async function hasActiveProduct(stripe: Stripe, customerId: string, app: App): Promise<boolean> {
  const { computeEntitlements, grantsAccess } = await import('./entitlements.js');
  const entitlements = await computeEntitlements(stripe, customerId);
  return grantsAccess(entitlements[app]);
}

/** Resolve-or-create exactly ONE Stripe customer for this email. */
export async function ensureCustomerForEmail(stripe: Stripe, email: string): Promise<string> {
  const existing = await findCustomerIdByEmail(stripe, email);
  if (existing) return existing;
  const created = await stripe.customers.create({ email: email.toLowerCase() });
  return created.id;
}

/**
 * Pick the right price for `app`: the $9.99 add-on rate if the customer already
 * owns the OTHER product, else the $29.99 standalone rate.
 *
 * Ownership is resolved by EMAIL across every Stripe customer holding it, not
 * from a single customer id — one email can own several customers (the old
 * checkout minted one per session), and the subscription that proves ownership
 * may sit on any of them.
 */
export async function resolvePriceFor(
  stripe: Stripe,
  app: App,
  opts: { customerId?: string | null; email?: string | null },
): Promise<{ priceId: string; tier: 'standalone' | 'addon'; customerId: string | null }> {
  const other: App = app === 'bounceback' ? 'swarmleads' : 'bounceback';
  const { computeEntitlements, computeEntitlementsForEmail, grantsAccess } = await import(
    './entitlements.js'
  );

  let customerId = opts.customerId ?? null;

  let ownsOther = false;
  if (opts.email) {
    // Email is the identity across both apps — check every customer under it.
    const entitlements = await computeEntitlementsForEmail(stripe, opts.email);
    ownsOther = grantsAccess(entitlements[other]);
    customerId ??= await findCustomerIdByEmail(stripe, opts.email);
  } else if (customerId) {
    const entitlements = await computeEntitlements(stripe, customerId);
    ownsOther = grantsAccess(entitlements[other]);
  }

  const tier: 'standalone' | 'addon' = ownsOther ? 'addon' : 'standalone';
  const priceId = await priceIdByLookupKey(stripe, LOOKUP_KEYS[app][tier]);
  return { priceId, tier, customerId };
}
