import type { Request, Response } from 'express';
import type { LoginBody, ExchangeBody } from './auth.schema.js';
import { startLogin, exchangeBounceBackToken } from './auth.service.js';

/** POST /api/auth/login — begin unified login via BounceBack. */
export async function login(req: Request, res: Response): Promise<void> {
  const { email } = req.body as LoginBody;
  const result = await startLogin(email);
  res.json(result);
}

/** POST /api/auth/exchange — trade a BounceBack user token for a SwarmLeads session. */
export async function exchange(req: Request, res: Response): Promise<void> {
  const { token } = req.body as ExchangeBody;
  const result = await exchangeBounceBackToken(token);
  res.json(result);
}

/** GET /api/auth/me — the current authenticated user (requireAuth sets req.user). */
export async function me(req: Request, res: Response): Promise<void> {
  res.json({ user: req.user });
}
