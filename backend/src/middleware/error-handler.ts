import type { ErrorRequestHandler } from 'express';
import { HttpError } from '../lib/http-error.js';

/**
 * Central error handler — every controller wraps async work in try/catch and
 * calls next(err); this turns errors into a consistent { error } JSON body.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : 'Internal server error';

  if (status >= 500) {
    console.error('Unhandled error:', err);
  }

  res.status(status).json({ error: message });
};
