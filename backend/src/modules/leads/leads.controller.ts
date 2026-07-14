import type { Request, Response } from 'express';
import { getStoredLeads, getLeadStats, getUserLeads } from './leads.service.js';
import { toLeadDTO } from './leads.serializer.js';
import { leadsToCsv } from './leads.csv.js';

/** GET /api/leads — the user's leads + stats. */
export async function listLeads(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const [leads, stats] = await Promise.all([getStoredLeads(userId), getLeadStats(userId)]);
  res.json({ leads, count: leads.length, stats });
}

/** GET /api/stats — the user's lead counts (for frontend polling). */
export async function getStats(req: Request, res: Response): Promise<void> {
  const stats = await getLeadStats(req.user!.userId);
  res.json(stats);
}

/** GET /api/leads/export — the user's leads as a downloadable CSV. */
export async function exportLeads(req: Request, res: Response): Promise<void> {
  const rows = await getUserLeads(req.user!.userId);
  const csv = leadsToCsv(rows.map(toLeadDTO));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="swarmleads-leads.csv"');
  res.send(csv);
}
