/**
 * Writer Bee — generates a personalized SMS outreach script per lead that
 * doesn't have one yet. Ported 1:1 from server/writer-bee.mjs.
 */
import type { Lead } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { randomItem } from '../../../utils/random.js';
import { SCRIPTS } from './templates.js';

function generateScript(lead: Lead): string | null {
  const templates = SCRIPTS[lead.industry];
  if (!templates) return null;

  const fullScript = [
    randomItem(templates.opener),
    randomItem(templates.body),
    randomItem(templates.closer),
  ].join('\n\n');

  const replacements: Record<string, string> = {
    '{contact}': lead.contactPerson || 'there',
    '{name}': 'Alex',
    '{company}': 'SwarmLeads',
    '{business}': lead.businessName || 'your business',
    '{region}': lead.region ? lead.region.split(',')[0].trim() : 'your area',
    '{industry}': lead.industry || 'your industry',
    '{angle}': lead.angle || 'We have a new lead generation system.',
  };

  return Object.entries(replacements).reduce(
    (text, [key, val]) => text.replaceAll(key, val),
    fullScript,
  );
}

export interface WriterResult {
  processed: number;
  errors: number;
  message: string;
}

export async function runWriter(userId?: string): Promise<WriterResult> {
  const unprocessed = await prisma.lead.findMany({
    where: {
      OR: [{ outreachScript: null }, { outreachScript: '' }],
      ...(userId ? { userId } : {}),
    },
  });

  if (unprocessed.length === 0) {
    return { processed: 0, errors: 0, message: 'No leads need scripts' };
  }

  let processed = 0;
  let errors = 0;

  for (const lead of unprocessed) {
    try {
      const script = generateScript(lead);
      if (!script) {
        errors++;
        continue;
      }
      await prisma.lead.update({ where: { id: lead.id }, data: { outreachScript: script } });
      processed++;
    } catch (err) {
      console.error(`Writer Bee error on lead ${lead.id}:`, (err as Error).message);
      errors++;
    }
  }

  return {
    processed,
    errors,
    message: `Writer Bee generated ${processed} outreach scripts`,
  };
}
