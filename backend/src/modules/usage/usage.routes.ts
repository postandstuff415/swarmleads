import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { usage } from './usage.controller.js';

export const usageRouter = Router();

usageRouter.get('/usage', requireAuth, asyncHandler(usage));
