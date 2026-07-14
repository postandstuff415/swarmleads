import type { Request, Response } from 'express';
import type { BouncebackSimulateBody } from './bounceback.schema.js';
import {
  simulateBounceBack,
  getActivity,
  getAddonStatus,
  startAddonCheckoutForUser,
} from './bounceback.service.js';

/** POST /api/bounceback/simulate — simulate one missed-call auto-reply (demo). */
export async function simulate(req: Request, res: Response): Promise<void> {
  const log = await simulateBounceBack(req.body as BouncebackSimulateBody);
  res.json({ success: true, log });
}

/** GET /api/bounceback/logs — the user's real BounceBack activity (or sim fallback). */
export async function listLogs(req: Request, res: Response): Promise<void> {
  const logs = await getActivity(req.user!.email);
  res.json({ logs, count: logs.length });
}

/** GET /api/bounceback/status — the user's $9.99 add-on entitlement. */
export async function addonStatus(req: Request, res: Response): Promise<void> {
  const status = await getAddonStatus(req.user!.email);
  res.json(status);
}

/** POST /api/bounceback/addon-checkout — start the $9.99 add-on purchase. */
export async function addonCheckout(req: Request, res: Response): Promise<void> {
  const result = await startAddonCheckoutForUser(req.user!.email);
  res.json(result);
}
