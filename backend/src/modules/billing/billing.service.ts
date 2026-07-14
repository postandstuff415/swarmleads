/**
 * $29.99/mo SwarmLeads subscription — a SEPARATE Stripe product from BounceBack.
 * Stubbed (activates without charging) when Stripe isn't configured.
 */
import type Stripe from 'stripe';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { getStripe, isStripeConfigured } from '../../lib/stripe.js';
import { resolvePriceFor, findCustomerIdByEmail, ensureCustomerForEmail } from '../../lib/pricing.js';
import {
  computeEntitlementsForEmail,
  grantsAccess,
  type Entitlement,
} from '../../lib/entitlements.js';
import type { SessionUser } from '../../lib/session.js';

export interface CheckoutResult {
  url: string;
  stubbed?: boolean;
}

/**
 * Short-lived cache so gating a request doesn't hit Stripe every time.
 * Keyed by userId. 60s is short enough that a cancellation takes effect fast.
 */
const entitlementCache = new Map<string, { entitlement: Entitlement; at: number }>();
const CACHE_TTL_MS = 60_000;

/**
 * The user's REAL SwarmLeads entitlement, reconciled from Stripe.
 *
 * We deliberately do not trust the local `subscriptionStatus` column: Stripe
 * events are delivered to BounceBack's webhook endpoint, so SwarmLeads can miss
 * cancellations entirely and would otherwise let a churned user keep scraping
 * (or lock out someone who just paid). Reading through to Stripe makes this
 * self-healing; the DB column becomes a cache we refresh as a side effect.
 */
export async function getEntitlement(user: SessionUser): Promise<Entitlement> {
  // Stub mode (no Stripe key): fall back to the local flag so demos still work.
  if (!isStripeConfigured()) {
    const record = await prisma.user.findUnique({ where: { id: user.userId } });
    return (record?.subscriptionStatus as Entitlement) ?? 'inactive';
  }

  const cached = entitlementCache.get(user.userId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.entitlement;

  const stripe = getStripe();

  // Resolve by EMAIL across every Stripe customer holding it — one email can own
  // several customers (the old checkout minted one per session), and the
  // subscription that proves entitlement may sit on any of them. A stored
  // customer id can also be stale (deleted, or from another test/live account),
  // so we never depend on it and never let it 500 the request.
  let entitlement: Entitlement = 'inactive';
  let customerId: string | null = null;

  try {
    entitlement = (await computeEntitlementsForEmail(stripe, user.email)).swarmleads;
    customerId = await findCustomerIdByEmail(stripe, user.email);
  } catch (err) {
    console.warn(`[Billing] Entitlement lookup failed for ${user.email}: ${(err as Error).message}`);
  }

  // Refresh the cached column so the DB reflects reality even without webhooks.
  await prisma.user.update({
    where: { id: user.userId },
    data: { subscriptionStatus: entitlement, stripeCustomerId: customerId },
  });

  entitlementCache.set(user.userId, { entitlement, at: Date.now() });
  return entitlement;
}

/** Is this user allowed to use paid SwarmLeads features right now? */
export async function hasAccess(user: SessionUser): Promise<boolean> {
  return grantsAccess(await getEntitlement(user));
}

/** Start (or stub) the subscription checkout for a user. */
export async function startCheckout(user: SessionUser): Promise<CheckoutResult> {
  const successUrl = `${env.SWARMLEADS_APP_URL}/?subscription=success`;
  const cancelUrl = `${env.SWARMLEADS_APP_URL}/?subscription=cancelled`;

  if (!isStripeConfigured()) {
    // Stub: no charge — activate so the flag/status path is testable.
    await prisma.user.update({
      where: { id: user.userId },
      data: { subscriptionStatus: 'active', subscriptionSince: new Date() },
    });
    return { url: successUrl, stubbed: true };
  }

  const stripe = getStripe();
  const record = await prisma.user.findUnique({ where: { id: user.userId } });

  // If they already have an active BounceBack subscription in the shared Stripe
  // account, SwarmLeads is the SECOND product → $9.99 add-on instead of $29.99.
  const { priceId, tier } = await resolvePriceFor(stripe, 'swarmleads', {
    customerId: record?.stripeCustomerId,
    email: user.email,
  });

  // Always bill against ONE customer per email. If Checkout is left to create
  // its own, a user who checks out twice ends up with duplicate customers and
  // parallel subscriptions.
  const customerId =
    record?.stripeCustomerId ?? (await ensureCustomerForEmail(stripe, user.email));

  console.log(`[Billing] SwarmLeads ${tier} price for ${user.email} (customer ${customerId})`);

  // No `payment_method_types` — Stripe picks eligible methods dynamically.
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId: user.userId, email: user.email },
  });

  return { url: session.url! };
}

/** Current subscription status for a user, reconciled against Stripe. */
export async function getSubscriptionStatus(
  user: SessionUser,
): Promise<{ status: string; since: Date | null; hasAccess: boolean }> {
  const status = await getEntitlement(user);
  const record = await prisma.user.findUnique({ where: { id: user.userId } });
  return { status, since: record?.subscriptionSince ?? null, hasAccess: grantsAccess(status) };
}

/** Map a Stripe subscription status to our internal vocabulary. */
function normalizeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    default:
      return 'inactive';
  }
}

/** Apply a verified Stripe webhook event to the user's subscription state. */
export async function applyWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const customerId = typeof session.customer === 'string' ? session.customer : undefined;
      if (userId) {
        // updateMany so a missing/unknown user doesn't 500 (avoids Stripe retries).
        await prisma.user.updateMany({
          where: { id: userId },
          data: {
            subscriptionStatus: 'active',
            subscriptionSince: new Date(),
            ...(customerId ? { stripeCustomerId: customerId } : {}),
          },
        });
      }
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : undefined;
      const status = event.type === 'customer.subscription.deleted' ? 'inactive' : normalizeStatus(sub.status);
      if (customerId) {
        await prisma.user.updateMany({ where: { stripeCustomerId: customerId }, data: { subscriptionStatus: status } });
      }
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : undefined;
      if (customerId) {
        await prisma.user.updateMany({ where: { stripeCustomerId: customerId }, data: { subscriptionStatus: 'past_due' } });
      }
      break;
    }
  }
}
