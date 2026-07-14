import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireSubscription } from '../../middleware/require-subscription.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { scrapeSchema } from './scrape.schema.js';
import { scrape, scrapeStatus, strategize, write } from './scrape.controller.js';

export const scrapeRouter = Router();

// Scraping spends real Outscraper money — it must be behind the paywall.
scrapeRouter.post('/scrape', asyncHandler(requireSubscription), validate(scrapeSchema), asyncHandler(scrape));
scrapeRouter.get('/scrape/:jobId', asyncHandler(scrapeStatus)); // reading own job status is free
scrapeRouter.post('/strategize', asyncHandler(requireSubscription), asyncHandler(strategize));
scrapeRouter.post('/write', asyncHandler(requireSubscription), asyncHandler(write));
