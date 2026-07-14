import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { loginSchema, exchangeSchema } from './auth.schema.js';
import { login, exchange, me } from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/auth/login', validate(loginSchema), asyncHandler(login));
authRouter.post('/auth/exchange', validate(exchangeSchema), asyncHandler(exchange));
authRouter.get('/auth/me', requireAuth, asyncHandler(me));
