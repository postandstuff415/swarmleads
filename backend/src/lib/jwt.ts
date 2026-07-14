/**
 * Minimal HS256 JWT sign/verify using Node's crypto — no external dependency.
 * Used for the cross-app bridge; the shared secret must match BounceBack's
 * SWARMLEADS_BRIDGE_JWT_SECRET (which verifies these tokens with `jose`).
 */
import crypto from 'node:crypto';

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export interface JwtClaims {
  iss: string;
  aud: string;
  sub?: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

/** Sign a claims object as an HS256 JWT. */
export function signJwt(claims: JwtClaims, secret: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify(claims));
  const data = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

/** Verify an HS256 JWT and return its claims, or null if invalid/expired. */
export function verifyJwt(token: string, secret: string): JwtClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as JwtClaims;
    if (typeof claims.exp === 'number' && claims.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}
