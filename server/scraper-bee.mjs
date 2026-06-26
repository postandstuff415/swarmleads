/**
 * Scraper Bee Engine
 * Simulates scanning local business registries, maps, and permit data
 * to extract high-intent leads based on industry and region.
 */

import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

const INDUSTRY_KEYWORDS = {
  'Roofing': ['Roofing', 'Roof', 'Leak Repair', 'Gutter', 'Shingle', 'Rooftop'],
  'Plumbing': ['Plumbing', 'Pipe', 'Drain', 'Water Heater', 'Septic', 'Hydro'],
  'HVAC': ['HVAC', 'Heating', 'Cooling', 'Air Conditioning', 'Furnace', 'Climate'],
  'Electrical': ['Electrical', 'Electric', 'Wiring', 'Circuit', 'Solar', 'Generator'],
  'Landscaping': ['Landscaping', 'Lawn', 'Garden', 'Tree', 'Irrigation', 'Hardscape'],
  'General Contracting': ['Construction', 'Contracting', 'Builders', 'Remodeling', 'Renovation'],
};

const FIRST_NAMES = [
  'James', 'Maria', 'Robert', 'Jennifer', 'Michael', 'Linda', 'David', 'Sarah',
  'William', 'Jessica', 'Richard', 'Karen', 'Joseph', 'Nancy', 'Thomas', 'Lisa',
  'Chris', 'Betty', 'Daniel', 'Margaret', 'Paul', 'Sandra', 'Mark', 'Ashley',
  'Donald', 'Dorothy', 'George', 'Kimberly', 'Kenneth', 'Emily', 'Steven', 'Amy',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
];

const ANGLES = [
  'Missed call text-back pitch',
  'Automated follow-up pitch',
  'Local SEO gap analysis',
  'Customer review automation',
  'Competitor price comparison',
  'Emergency service outreach',
  'Seasonal maintenance offer',
  'Referral program setup',
  'Google Maps optimization',
  'Social proof campaign',
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone() {
  const area = Math.floor(Math.random() * 900) + 100;
  const prefix = Math.floor(Math.random() * 900) + 100;
  const line = Math.floor(Math.random() * 9000) + 1000;
  return `(${area}) ${prefix}-${line}`;
}

function randomEmail(name, businessName) {
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const domain = ['gmail.com', 'outlook.com', 'yahoo.com', `${slug}.com`, `${slug}.io`][Math.floor(Math.random() * 5)];
  const local = name.toLowerCase().replace(/\s+/g, '.');
  return `${local}@${domain}`;
}

function generateBusinessName(industry, region, index) {
  const keywords = INDUSTRY_KEYWORDS[industry] || [industry];
  const kw = keywords[index % keywords.length];
  const suffixes = ['Pro', 'Experts', 'Services', 'Solutions', 'Masters', 'Team', 'Co', 'LLC', 'Group', 'Specialists'];
  
  // Vary the patterns
  const pattern = index % 3;
  if (pattern === 0) return `${region} ${kw} ${randomItem(suffixes)}`;
  if (pattern === 1) return `${region} ${randomItem(suffixes)} ${kw}`;
  return `${kw} of ${region}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run the Team DB CLI tool to execute SQL
 */
function runDb(sql) {
  const result = execSync(`team-db "${sql.replace(/"/g, '\\"')}"`, {
    encoding: 'utf-8',
    timeout: 30000,
  });
  return JSON.parse(result || '[]');
}

/**
 * Scrape leads for a given industry and region.
 * Returns an array of lead objects and stores them in the team database.
 */
export async function scrapeLeads({ industry, region, target = 50 }) {
  if (!industry) throw new Error('industry is required');
  if (!region) throw new Error('region is required');

  // Validate industry
  const validIndustries = Object.keys(INDUSTRY_KEYWORDS);
  if (!validIndustries.includes(industry)) {
    throw new Error(`Invalid industry. Must be one of: ${validIndustries.join(', ')}`);
  }

  // Simulate scraping time (1-3 seconds)
  const scrapeDuration = 1000 + Math.random() * 2000;
  await sleep(scrapeDuration);

  const leads = [];
  const count = Math.min(target, 50); // Cap at 50 for performance

  for (let i = 0; i < count; i++) {
    const businessName = generateBusinessName(industry, region, i);
    const firstName = randomItem(FIRST_NAMES);
    const lastName = randomItem(LAST_NAMES);
    const contactPerson = `${firstName} ${lastName}`;
    const angle = randomItem(ANGLES);
    
    leads.push({
      id: randomUUID(),
      business_name: businessName,
      contact_person: contactPerson,
      phone: randomPhone(),
      email: randomEmail(contactPerson, businessName),
      industry,
      region,
      angle,
      source: 'scraper',
    });
  }

  // Store in team database
  for (const lead of leads) {
    const sql = `INSERT INTO leads (id, business_name, contact_person, phone, email, industry, region, angle, source, status) VALUES ('${lead.id}', '${lead.business_name.replace(/'/g, "''")}', '${lead.contact_person.replace(/'/g, "''")}', '${lead.phone}', '${lead.email}', '${industry}', '${region}', '${lead.angle.replace(/'/g, "''")}', 'scraper', 'new')`;
    try {
      runDb(sql);
    } catch (err) {
      console.error(`Failed to insert lead ${lead.business_name}:`, err.message);
    }
  }

  return leads;
}

/**
 * Get all stored leads from the team database.
 */
export function getStoredLeads() {
  return runDb("SELECT id, business_name, contact_person, phone, email, industry, region, angle, source, created_at FROM leads ORDER BY created_at DESC");
}

/**
 * Delete all leads (for testing/reset).
 */
export function clearLeads() {
  return runDb("DELETE FROM leads");
}