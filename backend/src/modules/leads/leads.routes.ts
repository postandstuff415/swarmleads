import { Router } from 'express';
import { requireSubscription } from '../../middleware/require-subscription.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { listLeads, getStats, exportLeads } from './leads.controller.js';

export const leadsRouter = Router();

// Viewing leads you already paid for stays open; bulk export is a paid feature.
leadsRouter.get('/leads', asyncHandler(listLeads));
leadsRouter.get('/leads/export', asyncHandler(requireSubscription), asyncHandler(exportLeads));
leadsRouter.get('/stats', asyncHandler(getStats));
