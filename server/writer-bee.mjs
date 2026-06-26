/**
 * Writer Bee Engine
 * Generates personalized SMS outreach scripts for each lead
 * based on their refined angle, business name, and industry.
 */

import { execSync } from 'child_process';

const SCRIPTS = {
  'Roofing': {
    opener: [
      "Hey {contact}, this is {name} with {company}. I noticed your business, {business}, is doing great work in {region}!",
      "Hi {contact}, {name} here from {company}. We've been following {business} in the {region} area.",
      "Hello {contact}, {name} at {company}. Quick question about {business} in {region}:",
    ],
    body: [
      "{angle}  I'd love to hop on a quick 5-minute call to share how we can help you book more jobs without lifting a finger.",
      "We've been helping {industry} contractors in {region} lock in more leads automatically. {angle}",
      "Most {industry} owners in {region} don't realize they're leaving money on the table. {angle}",
    ],
    closer: [
      "Want me to send over a free sample for {business}? Just reply YES and I'll have it ready in 5 minutes.",
      "Free 14-day trial — no credit card needed. Hit reply and I'll get you set up right now.",
      "Can I send you a quick 1-page overview? Just reply with your email and I'll shoot it over.",
    ],
  },
  'Plumbing': {
    opener: [
      "Hey {contact}, this is {name} with {company}. Saw {business} servicing {region} — awesome work!",
      "Hi {contact}, {name} from {company}. Quick note about {business} in {region}:",
      "Hello {contact}, {name} at {company}. Was checking out {business} in the {region} area.",
    ],
    body: [
      "{angle}  We're offering a free strategy session for {industry} businesses in {region}.",
      "We've automated lead gen for {industry} pros across {region} with insane results. {angle}",
      "{business} could be getting way more calls from {region} homeowners. {angle}",
    ],
    closer: [
      "Reply YES and I'll send you a custom lead sample for {business} — takes 2 minutes to set up.",
      "Want to grab a quick 10-minute call this week? Just let me know what time works.",
      "Free trial available right now for {business}. Reply and I'll activate it instantly.",
    ],
  },
  'HVAC': {
    opener: [
      "Hey {contact}, {name} with {company}. Love what {business} is doing in {region}!",
      "Hi {contact}, {name} here from {company}. Quick thought about {business} in {region}:",
      "Hello {contact}, {name} at {company}. Noticed {business} is crushing it in {region}.",
    ],
    body: [
      "{angle}  We help {industry} companies in {region} fill their calendar without cold calling.",
      "Imagine getting pre-qualified {industry} leads in {region} delivered to your phone. {angle}",
      "Most {industry} businesses in {region} are missing out on automatic follow-ups. {angle}",
    ],
    closer: [
      "Want to see a real lead sample for {region}? Reply YES and I'll text it to you.",
      "Free 14-day trial — zero risk. Reply and I'll get {business} set up in under 5 minutes.",
      "Can I send over some numbers from similar {industry} businesses in {region}? Just reply with your email.",
    ],
  },
  'Electrical': {
    opener: [
      "Hey {contact}, {name} with {company}. Great to connect! {business} has a solid rep in {region}.",
      "Hi {contact}, {name} from {company}. Quick message about {business} in {region}:",
      "Hello {contact}, {name} at {company}. Saw {business} doing work in {region} — impressive!",
    ],
    body: [
      "{angle}  We specialize in helping {industry} contractors in {region} grow without the grind.",
      "We've built a system that brings {region} homeowners directly to {business}. {angle}",
      "There's a gap in the {region} {industry} market and {business} is perfectly positioned. {angle}",
    ],
    closer: [
      "Reply YES and I'll prepare a custom {region} lead report for {business} in 60 seconds.",
      "Free trial available for {business}. Reply and I'll activate it — takes 2 minutes.",
      "Want to chat for 5 minutes this week? Just tell me a good time and I'll call you.",
    ],
  },
  'Landscaping': {
    opener: [
      "Hey {contact}, {name} with {company}. {business} has some of the best work I've seen in {region}!",
      "Hi {contact}, {name} from {company}. Quick note about {business} in {region}:",
      "Hello {contact}, {name} at {company}. Was admiring {business}'s work around {region}.",
    ],
    body: [
      "{angle}  We help {industry} teams in {region} fill their schedule without chasing leads.",
      "Imagine homeowners in {region} reaching out to {business} first. We make that happen. {angle}",
      "Most {industry} companies in {region} don't have a system for capturing missed calls. {angle}",
    ],
    closer: [
      "Reply YES and I'll show you how {business} can get 3-5 new leads this week from {region}.",
      "Free trial — no strings. Hit reply and I'll set {business} up right now.",
      "Want a quick demo? Reply with your number and I'll text you a live example in 2 minutes.",
    ],
  },
  'General Contracting': {
    opener: [
      "Hey {contact}, {name} here with {company}. {business} is making waves in {region}!",
      "Hi {contact}, {name} from {company}. Quick thought about {business} in {region}:",
      "Hello {contact}, {name} at {company}. I've seen {business}'s projects around {region} — solid work.",
    ],
    body: [
      "{angle}  We're helping {industry} firms in {region} automate their lead flow end-to-end.",
      "Most {industry} contractors in {region} lose jobs because they miss the first call. {angle}",
      "We built a system that delivers high-intent {region} leads straight to {business}. {angle}",
    ],
    closer: [
      "Reply YES and I'll send over a sample lead pack for {region} — customized for {business}.",
      "Free 14-day trial for {business}. Reply and I'll activate it in 2 minutes flat.",
      "Can I send you a 1-minute video showing how it works? Just reply with your email.",
    ],
  },
};

/**
 * Run the Team DB CLI
 */
function runDb(sql) {
  const result = execSync(`team-db "${sql.replace(/"/g, '\\"')}"`, {
    encoding: 'utf-8',
    timeout: 30000,
  });
  return JSON.parse(result || '[]');
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a personalized SMS outreach script for a lead
 */
function generateScript(lead) {
  const templates = SCRIPTS[lead.industry];
  if (!templates) return null;

  const opener = randomItem(templates.opener);
  const body = randomItem(templates.body);
  const closer = randomItem(templates.closer);

  // Build personalized message
  const fullScript = `${opener}\n\n${body}\n\n${closer}`;

  // Replace placeholders
  const replacements = {
    '{contact}': lead.contact_person || 'there',
    '{name}': 'Alex',
    '{company}': 'SwarmLeads',
    '{business}': lead.business_name || 'your business',
    '{region}': lead.region ? lead.region.split(',')[0].trim() : 'your area',
    '{industry}': lead.industry || 'your industry',
    '{angle}': lead.angle || 'We have a new lead generation system.',
  };

  return Object.entries(replacements).reduce(
    (text, [key, val]) => text.replaceAll(key, val),
    fullScript
  );
}

/**
 * Run the Writer Bee on all leads without outreach scripts
 */
export function runWriter() {
  const unprocessedLeads = runDb("SELECT * FROM leads WHERE outreach_script IS NULL OR outreach_script = ''");

  if (unprocessedLeads.length === 0) {
    return { processed: 0, message: 'No leads need scripts' };
  }

  let processed = 0;
  let errors = 0;

  for (const lead of unprocessedLeads) {
    try {
      const script = generateScript(lead);
      if (!script) {
        errors++;
        continue;
      }
      const safeScript = script.replace(/'/g, "''");
      const sql = `UPDATE leads SET outreach_script = '${safeScript}' WHERE id = '${lead.id}'`;
      runDb(sql);
      processed++;
    } catch (err) {
      console.error(`Writer Bee error on lead ${lead.id}:`, err.message);
      errors++;
    }
  }

  return {
    processed,
    errors,
    message: `Writer Bee generated ${processed} outreach scripts`,
  };
}