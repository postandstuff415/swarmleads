/**
 * BounceBack SMS Bee
 * Simulates automated missed-call text-back service.
 * When a contractor misses a call, this sends an auto-reply SMS.
 * Part of the $9.99/mo add-on bundle.
 */

import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

const RESPONSE_TEMPLATES = [
  "Hey, sorry I missed your call! Just saw you were looking for {industry} services in {region}. How can I help? - {business_name}",
  "Sorry I couldn't pick up! Were you calling about {industry} work in {region}? Text me back and I'll get right on it. - {business_name}",
  "Missed your call! If you need {industry} help in {region}, I'm your person. Shoot me a text and I'll call you right back. - {business_name}",
  "Hey! Sorry I missed you. Need {industry} services in {region}? Let me know what you need and I'll send over a quote ASAP. - {business_name}",
  "Just missed you! Were you calling about {industry} in {region}? Text me back and I'll squeeze you in this week. - {business_name}",
];

const SAMPLE_INCOMING = [
  '(510) 555-0199',
  '(415) 555-0234',
  '(925) 555-0412',
  '(510) 555-0387',
  '(707) 555-0165',
  '(408) 555-0921',
  '(209) 555-0743',
];

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
 * Simulate a missed-call bounceback event.
 * @param {string} incomingNumber - The number that called
 * @param {string} industry - The contractor's industry
 * @param {string} region - The contractor's region
 * @param {string} businessName - The contractor's business name
 * @returns {object} The logged bounceback event
 */
export function simulateBounceBack({ incomingNumber, industry, region, businessName }) {
  const template = randomItem(RESPONSE_TEMPLATES);
  const outgoingText = template
    .replace(/{industry}/g, industry || 'your industry')
    .replace(/{region}/g, region || 'your area')
    .replace(/{business_name}/g, businessName || 'our team');

  const logEntry = {
    id: randomUUID(),
    incoming_number: incomingNumber || randomItem(SAMPLE_INCOMING),
    outgoing_text: outgoingText,
    industry: industry || '',
    region: region || '',
    status: 'sent',
  };

  const sql = `INSERT INTO bounceback_logs (id, incoming_number, outgoing_text, industry, region, status) VALUES ('${logEntry.id}', '${logEntry.incoming_number}', '${logEntry.outgoing_text.replace(/'/g, "''")}', '${logEntry.industry}', '${logEntry.region}', '${logEntry.status}')`;
  
  try {
    runDb(sql);
  } catch (err) {
    console.error('Failed to log bounceback:', err.message);
  }

  return logEntry;
}

/**
 * Get all bounceback logs
 */
export function getBounceBackLogs() {
  return runDb("SELECT * FROM bounceback_logs ORDER BY created_at DESC");
}

/**
 * Clear all logs (for testing)
 */
export function clearBounceBackLogs() {
  return runDb("DELETE FROM bounceback_logs");
}