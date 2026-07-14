import type { Request, Response } from 'express';
import type { PushBody } from './outreach.schema.js';
import { pushLeads } from './outreach.service.js';

/** POST /api/outreach/push — push selected leads to BounceBack's SMS outreach. */
export async function push(req: Request, res: Response): Promise<void> {
  const { leadIds } = req.body as PushBody;
  const result = await pushLeads(req.user!, leadIds);
  res.json({ success: true, ...result });
}
