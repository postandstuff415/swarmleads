import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../lib/http-error.js';
import { readSession, type SessionUser } from '../lib/session.js';

// Augment Express's Request with the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

/** Read + validate the Bearer session token; returns the user or null. */
export function getSessionUser(req: Request): SessionUser | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return readSession(header.substring(7).trim());
}

/** Gate a route/router: 401 unless a valid session token is present. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const user = getSessionUser(req);
  if (!user) {
    throw new HttpError(401, 'Authentication required');
  }
  req.user = user;
  next();
}
