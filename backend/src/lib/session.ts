/**
 * SwarmLeads session tokens — the app's OWN signed JWT, independent of the
 * cross-app bridge secret. Issued after a BounceBack-issued user token is
 * validated at /api/auth/callback; validated on every protected request.
 */
import { env } from '../config/env.js';
import { signJwt, verifyJwt } from './jwt.js';

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const ISS = 'swarmleads-app';
const AUD = 'swarmleads-app';

export interface SessionUser {
  userId: string;
  email: string;
}

function secret(): string {
  const s = env.SWARMLEADS_SESSION_SECRET;
  if (!s) throw new Error('SWARMLEADS_SESSION_SECRET is not configured');
  return s;
}

/** Sign a session token for a user. */
export function issueSession(user: SessionUser): string {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    { iss: ISS, aud: AUD, sub: user.userId, email: user.email, iat: now, exp: now + SESSION_TTL_SECONDS },
    secret(),
  );
}

/** Validate a session token; returns the user or null. */
export function readSession(token: string): SessionUser | null {
  const claims = verifyJwt(token, secret());
  if (!claims || claims.iss !== ISS || claims.aud !== AUD) return null;
  if (typeof claims.sub !== 'string' || typeof claims.email !== 'string') return null;
  return { userId: claims.sub, email: claims.email };
}
