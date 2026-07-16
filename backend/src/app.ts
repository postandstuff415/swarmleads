import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { leadsRouter } from './modules/leads/leads.routes.js';
import { scrapeRouter } from './modules/scrape/scrape.routes.js';
import { bouncebackRouter } from './modules/bounceback/bounceback.routes.js';
import { billingRouter } from './modules/billing/billing.routes.js';
import { webhook as billingWebhook } from './modules/billing/billing.controller.js';
import { outreachRouter } from './modules/outreach/outreach.routes.js';
import { usageRouter } from './modules/usage/usage.routes.js';
import { requireAuth } from './middleware/require-auth.js';
import { asyncHandler } from './utils/async-handler.js';
import { notFound } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';

export function createApp() {
  const app = express();

  app.use(cors());

  // Stripe webhook needs the raw body for signature verification — mount it
  // with express.raw BEFORE the global JSON parser.
  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), asyncHandler(billingWebhook));

  app.use(express.json());

  // Public routes: health + auth (login/exchange are how you get a session).
  app.use('/api', healthRouter);
  app.use('/api', authRouter);

  // Everything below requires a valid SwarmLeads session; req.user is set here.
  app.use('/api', requireAuth, leadsRouter);
  app.use('/api', requireAuth, scrapeRouter);
  app.use('/api', requireAuth, billingRouter);
  app.use('/api', outreachRouter); // requireAuth applied per-route
  app.use('/api', usageRouter); // requireAuth applied per-route
  app.use('/api/bounceback', requireAuth, bouncebackRouter);

  // --- Serve the built frontend (single-server production deploy) ---
  // The Vite SPA is built to frontend/dist; in production the API process also
  // serves those static assets, so one origin handles everything and nginx just
  // reverse-proxies the domain to this port. Skipped in dev/test (no build dir),
  // where Vite serves the SPA and proxies /api here.
  const frontendDir =
    env.FRONTEND_DIST_PATH ??
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');

  if (fs.existsSync(path.join(frontendDir, 'index.html'))) {
    app.use(express.static(frontendDir));
    // SPA fallback: any non-/api GET that didn't match a static file returns the
    // app shell so client-side routes (e.g. /auth/callback) work on refresh.
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(path.join(frontendDir, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
