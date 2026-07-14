import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { checkout, status } from './billing.controller.js';

// Authenticated billing routes. The webhook is mounted separately in app.ts
// because it needs the raw request body for signature verification.
export const billingRouter = Router();

billingRouter.post('/billing/checkout', requireAuth, asyncHandler(checkout));
billingRouter.get('/billing/status', requireAuth, asyncHandler(status));
