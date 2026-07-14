import type { RequestHandler } from 'express';
import { z, type ZodType } from 'zod';

type Target = 'body' | 'query' | 'params';

/**
 * Build an Express middleware that validates a request segment against a Zod
 * schema. On success the parsed (and coerced) value replaces the original, so
 * downstream controllers get typed, clean input. On failure it responds 400.
 */
export function validate(schema: ZodType, target: Target = 'body'): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: z.flattenError(result.error).fieldErrors,
      });
      return;
    }
    // req.query/params are read-only getters in Express 5 — assign only body safely,
    // and stash parsed values for the others.
    if (target === 'body') {
      req.body = result.data;
    } else {
      // req.query/params are read-only getters in Express 5 — stash the parsed
      // value for controllers that opt in to reading it.
      (req as unknown as Record<string, unknown>)[`validated_${target}`] = result.data;
    }
    next();
  };
}
