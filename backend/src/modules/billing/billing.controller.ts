import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { env } from '../../config/env.js';
import { getStripe, isStripeConfigured } from '../../lib/stripe.js';
import { startCheckout, getSubscriptionStatus, applyWebhookEvent } from './billing.service.js';

/** POST /api/billing/checkout (auth) — start/stub the $29.99 subscription. */
export async function checkout(req: Request, res: Response): Promise<void> {
  const result = await startCheckout(req.user!);
  res.json(result);
}

/** GET /api/billing/status (auth) — the user's subscription status. */
export async function status(req: Request, res: Response): Promise<void> {
  const result = await getSubscriptionStatus(req.user!);
  res.json(result);
}

/**
 * POST /api/billing/webhook (public, raw body) — Stripe subscription events.
 * Verifies the signature when configured; in non-prod without config it parses
 * the mock JSON body so the flow can be exercised without Stripe.
 */
export async function webhook(req: Request, res: Response): Promise<void> {
  let event: Stripe.Event;

  if (isStripeConfigured() && env.STRIPE_WEBHOOK_SECRET) {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }
    try {
      // req.body is a Buffer here (express.raw mounted for this route).
      event = getStripe().webhooks.constructEvent(
        req.body as Buffer,
        signature as string,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      res.status(400).json({ error: `Signature verification failed: ${(err as Error).message}` });
      return;
    }
  } else if (env.NODE_ENV !== 'production') {
    try {
      const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
      event = JSON.parse(raw) as Stripe.Event;
    } catch {
      res.status(400).json({ error: 'Invalid JSON payload' });
      return;
    }
  } else {
    res.status(400).json({ error: 'Stripe webhook not configured' });
    return;
  }

  await applyWebhookEvent(event);
  res.json({ received: true });
}
