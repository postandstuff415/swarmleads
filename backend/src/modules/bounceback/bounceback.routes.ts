import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { bouncebackSimulateSchema } from './bounceback.schema.js';
import { simulate, listLogs, addonStatus, addonCheckout } from './bounceback.controller.js';

export const bouncebackRouter = Router();

bouncebackRouter.post('/simulate', validate(bouncebackSimulateSchema), asyncHandler(simulate));
bouncebackRouter.get('/logs', asyncHandler(listLogs));
bouncebackRouter.get('/status', asyncHandler(addonStatus));
bouncebackRouter.post('/addon-checkout', asyncHandler(addonCheckout));
