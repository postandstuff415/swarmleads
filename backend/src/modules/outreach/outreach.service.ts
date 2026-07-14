/**
 * Push-to-SMS Outreach — send selected leads into BounceBack's outreach queue
 * via the bridge, and record the push locally in OutreachQueue.
 */
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../lib/http-error.js';
import { pushLeadsToBounceBack, type BridgeLead } from '../../lib/bridge-client.js';

export interface PushResult {
  queued: number;
  skipped: number;
}

/**
 * Push the given leads (owned by `user`) to BounceBack. Only leads with a phone
 * are sent; each attempt is recorded in OutreachQueue (PUSHED or FAILED).
 */
export async function pushLeads(
  user: { userId: string; email: string },
  leadIds: string[],
): Promise<PushResult> {
  // Scope strictly to the caller's own leads.
  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds }, userId: user.userId },
  });
  if (leads.length === 0) {
    throw new HttpError(404, 'No matching leads found');
  }

  const sendable = leads.filter((l) => !!l.phone);
  const skipped = leads.length - sendable.length;
  if (sendable.length === 0) {
    throw new HttpError(400, 'None of the selected leads have a phone number');
  }

  const payload: BridgeLead[] = sendable.map((l) => ({
    phone: l.phone!,
    businessName: l.businessName,
    metadata: { leadId: l.id, industry: l.industry, region: l.region },
  }));

  try {
    const { queued } = await pushLeadsToBounceBack(user.email, payload);
    await prisma.outreachQueue.createMany({
      data: sendable.map((l) => ({ leadId: l.id, status: 'PUSHED' as const })),
    });
    return { queued, skipped };
  } catch (err) {
    await prisma.outreachQueue.createMany({
      data: sendable.map((l) => ({ leadId: l.id, status: 'FAILED' as const })),
    });
    throw new HttpError(502, `Push to BounceBack failed: ${(err as Error).message}`);
  }
}
