/**
 * Stripe client helper. Billing runs in "stub" mode when no key is configured
 * (activates the subscription without charging), mirroring the BounceBack
 * $9.99 add-on pattern, so the flow is exercisable end-to-end pre-launch.
 */
import Stripe from 'stripe';
import { env } from '../config/env.js';

export function isStripeConfigured(): boolean {
  const key = env.STRIPE_API_KEY;
  return !!key && !key.includes('your_stripe') && key.trim() !== '';
}

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }
  if (!client) {
    client = new Stripe(env.STRIPE_API_KEY!);
  }
  return client;
}
