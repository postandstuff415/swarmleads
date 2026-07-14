import type { LeadDTO } from './leads.serializer.js';

const COLUMNS: Array<{ header: string; key: keyof LeadDTO }> = [
  { header: 'Business Name', key: 'business_name' },
  { header: 'Contact Person', key: 'contact_person' },
  { header: 'Phone', key: 'phone' },
  { header: 'Email', key: 'email' },
  { header: 'Website', key: 'website' },
  { header: 'Industry', key: 'industry' },
  { header: 'Region', key: 'region' },
  { header: 'Rating', key: 'rating' },
  { header: 'Reviews', key: 'reviews' },
  { header: 'Angle', key: 'angle' },
  { header: 'Status', key: 'status' },
  { header: 'Score', key: 'score' },
  { header: 'Outreach Script', key: 'outreach_script' },
  { header: 'Created At', key: 'created_at' },
];

/** Escape a value for CSV (RFC 4180): quote if it contains comma/quote/newline. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize serialized leads to a CSV string with a header row. */
export function leadsToCsv(leads: LeadDTO[]): string {
  const header = COLUMNS.map((c) => c.header).join(',');
  const rows = leads.map((lead) => COLUMNS.map((c) => csvCell(lead[c.key])).join(','));
  return [header, ...rows].join('\r\n');
}
