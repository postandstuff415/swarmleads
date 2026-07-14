import { prisma } from '../../lib/prisma.js';
import { toLeadDTO, type LeadDTO } from './leads.serializer.js';

export interface LeadStats {
  total: number;
  verified: number;
  highIntent: number;
}

/** A user's leads (newest first), serialized to the frontend's snake_case shape. */
export async function getStoredLeads(userId: string): Promise<LeadDTO[]> {
  const leads = await prisma.lead.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return leads.map(toLeadDTO);
}

/** Raw Lead rows for a user (used by CSV export). */
export function getUserLeads(userId: string) {
  return prisma.lead.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

/** Lead counts for a user: total, verified (verified + high_intent), high_intent. */
export async function getLeadStats(userId: string): Promise<LeadStats> {
  const [total, verified, highIntent] = await Promise.all([
    prisma.lead.count({ where: { userId } }),
    prisma.lead.count({ where: { userId, status: { in: ['VERIFIED', 'HIGH_INTENT'] } } }),
    prisma.lead.count({ where: { userId, status: 'HIGH_INTENT' } }),
  ]);
  return { total, verified, highIntent };
}
