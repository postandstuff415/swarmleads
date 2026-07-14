import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '0.1',
    bees: ['Scraper Bee', 'Strategist Bee', 'Writer Bee'],
  });
});
