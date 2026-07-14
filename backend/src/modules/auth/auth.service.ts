/**
 * Unified-login service. BounceBack owns identity and issues a signed user JWT
 * (iss:"bounceback", aud:"swarmleads", signed with the shared bridge secret).
 * SwarmLeads validates that token, upserts a local User, and exchanges it for
 * its own longer-lived session token.
 */
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { verifyJwt } from '../../lib/jwt.js';
import { issueSession, type SessionUser } from '../../lib/session.js';
import { requestLoginLink } from '../../lib/bridge-client.js';
import { HttpError } from '../../lib/http-error.js';

export interface LoginResult {
  // Instant (dev) path: session ready. Magic-link (prod) path: check your email.
  token?: string;
  user?: SessionUser;
  magicLink?: boolean;
  message?: string;
}

function bridgeSecret(): string {
  if (!env.SWARMLEADS_BRIDGE_JWT_SECRET) {
    throw new HttpError(500, 'Bridge not configured (SWARMLEADS_BRIDGE_JWT_SECRET)');
  }
  return env.SWARMLEADS_BRIDGE_JWT_SECRET;
}

/**
 * Validate a BounceBack-issued user token and exchange it for a SwarmLeads
 * session. Upserts the local User by email so leads/jobs can be scoped to it.
 */
export async function exchangeBounceBackToken(token: string): Promise<{ token: string; user: SessionUser }> {
  const claims = verifyJwt(token, bridgeSecret());
  if (!claims || claims.iss !== 'bounceback' || claims.aud !== 'swarmleads' || typeof claims.sub !== 'string') {
    throw new HttpError(401, 'Invalid or expired login token');
  }

  const email = claims.sub.toLowerCase();
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  const sessionUser: SessionUser = { userId: user.id, email: user.email };
  return { token: issueSession(sessionUser), user: sessionUser };
}

/** Start login: ask BounceBack for an instant token (dev) or a magic link (prod). */
export async function startLogin(email: string): Promise<LoginResult> {
  const returnTo = `${env.SWARMLEADS_APP_URL}/auth/callback`;
  const resp = await requestLoginLink(email, returnTo);

  if (resp.instant && resp.token) {
    // Dev path: exchange the instant token immediately and return a session.
    return exchangeBounceBackToken(resp.token);
  }

  return { magicLink: true, message: resp.message ?? 'Check your email for a sign-in link.' };
}
