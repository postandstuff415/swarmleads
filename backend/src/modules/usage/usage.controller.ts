import type { Request, Response } from 'express';
import { getMonthlyUsage } from './usage.service.js';

/** GET /api/usage — this month's lead allowance consumption for the current user. */
export async function usage(req: Request, res: Response): Promise<void> {
  const result = await getMonthlyUsage(req.user!.userId);
  res.json(result);
}
