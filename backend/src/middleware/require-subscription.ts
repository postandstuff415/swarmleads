import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../lib/http-error.js';
import { env } from '../config/env.js';
import { hasAccess } from '../modules/billing/billing.service.js';

/**
 * Gate paid features behind an active (or trialing) SwarmLeads subscription.
 *
 * Without this, the $29.99 paywall was purely cosmetic — anyone with a
 * BounceBack account could log in and scrape, export, and push leads for free,
 * spending real Outscraper money. Entitlement is read through to Stripe (see
 * billing.service.getEntitlement), so it cannot go stale.
 *
 * Set REQUIRE_SUBSCRIPTION=false to disable for local demos.
 */
export async function requireSubscription(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!env.REQUIRE_SUBSCRIPTION) return next();

  if (!(await hasAccess(req.user!))) {
    throw new HttpError(402, 'An active SwarmLeads subscription is required. Subscribe for $29.99/mo to continue.');
  }
  next();
}
