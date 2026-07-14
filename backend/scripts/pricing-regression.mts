/**
 * Cross-product pricing regression test.
 *
 * This asserts the REAL failure shape that reached a customer, not the happy
 * path that hid it: a customer whose BounceBack subscription sits on a LEGACY
 * ad-hoc inline price (no lookup_key, product has no metadata.app), AND who has
 * a duplicate Stripe customer for the same email. Both conditions made the
 * entitlement engine believe they owned nothing, so SwarmLeads quoted the
 * $29.99 standalone rate instead of the $9.99 add-on — double-billing them.
 *
 * Run:  STRIPE_API_KEY=sk_test_... npx tsx scripts/pricing-regression.mts
 */
import Stripe from 'stripe';
import { resolvePriceFor } from '../src/lib/pricing.js';
import { computeEntitlementsForEmail } from '../src/lib/entitlements.js';

const stripe = new Stripe(process.env.STRIPE_API_KEY!);

let pass = 0;
let fail = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = got === want;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n        got=${got}  want=${want}`);
  ok ? pass++ : fail++;
}

async function priceOf(id: string) {
  const p = await stripe.prices.retrieve(id);
  return `$${((p.unit_amount ?? 0) / 100).toFixed(2)}`;
}

/** Seed the exact broken shape: legacy inline price + a duplicate customer. */
async function seedLegacyCustomer(email: string) {
  // Duplicate customer #1 (empty) — mimics the old checkout minting a customer per session.
  await stripe.customers.create({ email });

  // Duplicate customer #2 — holds a BounceBack sub on an ad-hoc INLINE price,
  // exactly as the pre-catalog checkout created them.
  const cust = await stripe.customers.create({ email });
  const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: cust.id });
  await stripe.customers.update(cust.id, {
    invoice_settings: { default_payment_method: pm.id },
  });

  // Reproduce the legacy shape: an UNTAGGED product (no metadata.app) with an
  // ad-hoc price that has NO lookup_key — i.e. invisible to the catalog map, so
  // classification must fall back to the product name.
  const legacyProduct = await stripe.products.create({
    name: 'BounceBack SMS Subscription', // the name our old checkout emitted
    // deliberately NO metadata.app
  });
  const legacyPrice = await stripe.prices.create({
    product: legacyProduct.id,
    currency: 'usd',
    unit_amount: 2999,
    recurring: { interval: 'month' },
    // deliberately NO lookup_key
  });

  await stripe.subscriptions.create({
    customer: cust.id,
    items: [{ price: legacyPrice.id }],
    trial_period_days: 14, // real onboarding trials — must still count as owned
  });

  return cust.id;
}

const stamp = process.env.SEED_STAMP ?? String(Date.now());
const legacyEmail = `legacy-regression-${stamp}@example.com`;
const freshEmail = `fresh-regression-${stamp}@example.com`;

console.log('Seeding the real failure shape (legacy inline price + duplicate customer)…\n');
await seedLegacyCustomer(legacyEmail);

// 1. The engine must SEE the legacy BounceBack subscription.
const ent = await computeEntitlementsForEmail(stripe, legacyEmail);
check('legacy+duplicate: bounceback entitlement recognized', ent.bounceback, 'trialing');
check('legacy+duplicate: swarmleads not owned', ent.swarmleads, 'inactive');

// 2. THE BUG: adding SwarmLeads must be the $9.99 add-on, not $29.99.
const addon = await resolvePriceFor(stripe, 'swarmleads', { email: legacyEmail });
check('legacy+duplicate: SwarmLeads tier', addon.tier, 'addon');
check('legacy+duplicate: SwarmLeads price', await priceOf(addon.priceId), '$9.99');

// 3. No regression: a genuinely new customer still pays standalone.
const fresh = await resolvePriceFor(stripe, 'swarmleads', { email: freshEmail });
check('brand-new customer: SwarmLeads tier', fresh.tier, 'standalone');
check('brand-new customer: SwarmLeads price', await priceOf(fresh.priceId), '$29.99');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
