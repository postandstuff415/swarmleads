import type { RequestHandler } from 'express';

/**
 * Wrap an async controller so rejected promises reach the error handler
 * instead of hanging the request.
 */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
