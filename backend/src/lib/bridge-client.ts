/**
 * Bridge client — signs short-lived HS256 JWTs and calls the BounceBack
 * integration API. Proves the shared-secret contract against BounceBack's
 * verifier now; the Push-to-SMS dispatch that consumes it is Phase 3.
 *
 * No-ops loudly if the bridge env (secret + URL) isn't configured, so the API
 * still boots without BounceBack wired up.
 */
import { env } from '../config/env.js';
import { signJwt } from './jwt.js';
import { HttpError } from './http-error.js';

const TOKEN_TTL_SECONDS = 300; // short-lived, minted per request

export interface BridgeLead {
  phone: string;
  businessName?: string;
  metadata?: Record<string, unknown>;
}

function bridgeConfig(): { secret: string; baseUrl: string } {
  const secret = env.SWARMLEADS_BRIDGE_JWT_SECRET;
  const baseUrl = env.BOUNCEBACK_API_URL;
  if (!secret || !baseUrl) {
    throw new Error(
      'Bridge not configured: set SWARMLEADS_BRIDGE_JWT_SECRET and BOUNCEBACK_API_URL',
    );
  }
  return { secret, baseUrl };
}

/** Mint a signed bridge token identifying the SwarmLeads user to BounceBack. */
export function mintBridgeToken(subjectEmail: string): string {
  const { secret } = bridgeConfig();
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    {
      iss: 'swarmleads',
      aud: 'bounceback',
      sub: subjectEmail,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    },
    secret,
  );
}

async function bridgeFetch(path: string, subjectEmail: string, init?: RequestInit): Promise<Response> {
  const { baseUrl } = bridgeConfig();
  const token = mintBridgeToken(subjectEmail);
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
}

/**
 * Initiate cross-app login. BounceBack (identity owner) either returns an
 * instant signed user token (dev) or emails a magic link (prod).
 */
export async function requestLoginLink(
  email: string,
  returnTo: string,
): Promise<{ instant?: boolean; token?: string; magicLink?: boolean; message?: string }> {
  // The M2M token's subject is the login email being requested.
  const res = await bridgeFetch('/api/integrations/swarmleads/login-link', email, {
    method: 'POST',
    body: JSON.stringify({ email, returnTo }),
  });
  if (res.status === 401 && (await res.clone().text()).includes('No account')) {
    throw new HttpError(404, 'No BounceBack account found for that email');
  }
  if (!res.ok) {
    throw new HttpError(502, `BounceBack login-link failed (${res.status})`);
  }
  return (await res.json()) as { instant?: boolean; token?: string; magicLink?: boolean; message?: string };
}

/** Check whether the BounceBack SwarmLeads add-on is active for a user. */
export async function getBounceBackAddonStatus(subjectEmail: string): Promise<{ addonActive: boolean }> {
  const res = await bridgeFetch('/api/integrations/swarmleads/status', subjectEmail);
  if (!res.ok) {
    throw new Error(`BounceBack status check failed (${res.status})`);
  }
  return (await res.json()) as { addonActive: boolean };
}

/** Push a batch of leads into BounceBack's outreach queue. */
export async function pushLeadsToBounceBack(
  subjectEmail: string,
  leads: BridgeLead[],
): Promise<{ queued: number }> {
  const res = await bridgeFetch('/api/integrations/swarmleads/leads', subjectEmail, {
    method: 'POST',
    body: JSON.stringify({ leads }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`BounceBack lead push failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as { queued: number };
}

/** Start the $9.99 add-on checkout on BounceBack; returns the checkout URL. */
export async function startAddonCheckout(subjectEmail: string): Promise<{ url: string; stubbed?: boolean }> {
  const res = await bridgeFetch('/api/integrations/swarmleads/checkout', subjectEmail, { method: 'POST' });
  if (!res.ok) {
    throw new HttpError(502, `BounceBack add-on checkout failed (${res.status})`);
  }
  return (await res.json()) as { url: string; stubbed?: boolean };
}

export interface BounceBackActivity {
  id: string;
  callerNumber: string | null;
  callStatus: string;
  smsSent: boolean;
  timestamp: string;
}

/** Read the user's recent BounceBack call/SMS activity (real logs). */
export async function getBounceBackActivity(subjectEmail: string): Promise<BounceBackActivity[]> {
  const res = await bridgeFetch('/api/integrations/swarmleads/activity', subjectEmail);
  if (!res.ok) {
    throw new HttpError(502, `BounceBack activity fetch failed (${res.status})`);
  }
  const body = (await res.json()) as { activity: BounceBackActivity[] };
  return body.activity ?? [];
}
