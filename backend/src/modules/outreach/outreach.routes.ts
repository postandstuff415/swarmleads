import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { requireSubscription } from '../../middleware/require-subscription.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { pushSchema } from './outreach.schema.js';
import { push } from './outreach.controller.js';

export const outreachRouter = Router();

outreachRouter.post(
  '/outreach/push',
  requireAuth,
  asyncHandler(requireSubscription),
  validate(pushSchema),
  asyncHandler(push),
);
