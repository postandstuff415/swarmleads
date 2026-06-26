/**
 * Strategist Bee Engine
 * Analyzes leads from the Scraper Bee, refines outreach angles,
 * and classifies leads as 'verified' or 'high_intent'.
 */

import { execSync } from 'child_process';

// Local outreach strategy templates keyed by industry
const STRATEGIES = {
  'Roofing': [
    'Offer a free drone roof inspection after recent storms in {region} — no-obligation estimate.',
    'Send a "Winter is coming" maintenance checklist to {region} homeowners with aging roofs.',
    'Run a "Neighbor Referral" campaign in {region}: $250 off for every referred signed roof.',
    'Target {region} real estate agents for pre-listing roof certifications — speed up closings.',
    'Post-storm emergency tarping service outreach in {region} — 30-minute response time.',
  ],
  'Plumbing': [
    'Offer a free water pressure test in {region} — identify hidden leaks before they burst.',
    'Send seasonal pipe-insulation reminders to {region} homeowners before winter freeze.',
    'Run a "Senior Discount" campaign in {region}: 15% off for 65+ homeowners.',
    'Target {region} property managers with annual plumbing inspection contracts.',
    'Same-day emergency service outreach in {region} — no overtime fees for new customers.',
  ],
  'HVAC': [
    'Offer a free AC efficiency audit in {region} — save up to 30% on summer cooling bills.',
    'Send "furnace tune-up" postcards to {region} homes with units over 10 years old.',
    'Run a "Filter Subscription" campaign in {region}: quarterly filter delivery + system check.',
    'Target {region} newly built homes for HVAC warranty registration follow-ups.',
    'Pre-summer AC maintenance special in {region}: $89 tune-up (normally $149).',
  ],
  'Electrical': [
    'Offer a free home safety inspection in {region} — knob-and-tube wiring identification.',
    'Send EV charger installation promos to {region} homeowners who recently bought EVs.',
    'Run a "Smart Home Bundle" campaign in {region} — lights, thermostat, lock installation.',
    'Target {region} kitchen remodelers for electrical upgrade partnership referrals.',
    'Generator backup power consultation in {region} — be ready for the next blackout.',
  ],
  'Landscaping': [
    'Offer a free curb appeal consultation in {region} — before-and-after 3D renderings.',
    'Send "Spring Cleanup" early-bird pricing to {region} homeowners in February.',
    'Run a "Drought-Tolerant Garden" campaign in {region} — save water, save money.',
    'Target {region} HOA boards for annual landscaping maintenance contracts.',
    'Hardscape installation special in {region}: patios, walkways, retaining walls — 0% financing.',
  ],
  'General Contracting': [
    'Offer a free permit-ready plan review in {region} for ADU or garage conversion projects.',
    'Send "Kitchen Refresh" mini-remodel promos to {region} homes built before 1990.',
    'Run a "Disaster-Proofing" campaign in {region} — seismic retrofitting, fire hardening.',
    'Target {region} insurance adjusters for rapid storm-damage repair partnerships.',
    'Multi-trade bundled service in {region}: roof + siding + windows — one contractor, one warranty.',
  ],
};

// Verification criteria (simulated) — checks that determine if a lead is real/good
const VERIFICATION_CHECKS = [
  // Business has a valid-sounding name
  (lead) => lead.business_name && lead.business_name.length > 5,
  // Contact person has both first and last name
  (lead) => lead.contact_person && lead.contact_person.includes(' '),
  // Phone looks valid
  (lead) => lead.phone && lead.phone.length >= 10,
  // Email looks valid
  (lead) => lead.email && lead.email.includes('@'),
];

// High-intent criteria — leads that are more likely to convert
const HIGH_INTENT_CHECKS = [
  // Business is a "Pro" or "Experts" type (sounds more established)
  (lead) => /Pro(s|fessionals)?$|Experts$|Services$|Solutions$/.test(lead.business_name),
  // Contact has a common/recognizable name tie (simulated: businesses with both names in contact)
  (lead) => lead.business_name && lead.contact_person && 
    lead.business_name.toLowerCase().includes(lead.contact_person.split(' ')[0].toLowerCase()),
  // Angle mentions emergency or urgent service
  (lead) => lead.angle && /emergency|same.day|24.?7|urgent|immediate/i.test(lead.angle),
  // Region appears in the business name (local business)
  (lead) => lead.business_name && lead.region && 
    lead.business_name.toLowerCase().includes(lead.region.toLowerCase().split(',')[0].toLowerCase()),
];

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

/**
 * Generate a refined outreach angle for a lead
 */
function generateRefinedAngle(lead) {
  const strategies = STRATEGIES[lead.industry];
  if (!strategies || strategies.length === 0) return lead.angle;
  
  // Pick a strategy based on the lead's name hash for deterministic but varied results
  const hash = lead.business_name.length + lead.region.length;
  const strategy = strategies[hash % strategies.length];
  
  // Replace {region} with the lead's actual region
  const regionShort = lead.region.split(',')[0].trim();
  return strategy.replace(/{region}/g, regionShort);
}

/**
 * Check if a lead passes verification
 */
function isVerified(lead) {
  const passes = VERIFICATION_CHECKS.filter(check => check(lead));
  // A lead is verified if it passes at least 3 out of 4 checks
  return passes.length >= 3;
}

/**
 * Check if a lead is high-intent
 */
function isHighIntent(lead) {
  if (!isVerified(lead)) return false;
  const passes = HIGH_INTENT_CHECKS.filter(check => check(lead));
  // High-intent if it passes at least 2 of 4 high-intent checks
  return passes.length >= 2;
}

/**
 * Run the Strategist Bee on all 'new' leads
 */
export function runStrategist() {
  // Get all leads with status 'new'
  const newLeads = runDb("SELECT * FROM leads WHERE status = 'new'");
  
  if (newLeads.length === 0) {
    return { processed: 0, message: 'No new leads to analyze' };
  }

  let verified = 0;
  let highIntent = 0;
  let errors = 0;

  for (const lead of newLeads) {
    try {
      // Generate refined angle
      const refinedAngle = generateRefinedAngle(lead);
      
      // Determine status
      const isHigh = isHighIntent(lead);
      const isVer = isVerified(lead);
      const status = isHigh ? 'high_intent' : isVer ? 'verified' : 'new';
      
      if (status === 'verified') verified++;
      if (status === 'high_intent') highIntent++;

      // Update the lead in the database
      const safeAngle = refinedAngle.replace(/'/g, "''");
      const sql = `UPDATE leads SET angle = '${safeAngle}', status = '${status}' WHERE id = '${lead.id}'`;
      runDb(sql);
    } catch (err) {
      console.error(`Strategist Bee error on lead ${lead.id}:`, err.message);
      errors++;
    }
  }

  return {
    processed: newLeads.length,
    verified,
    highIntent,
    errors,
    message: `Strategist Bee analyzed ${newLeads.length} leads: ${verified} verified, ${highIntent} high-intent`,
  };
}

/**
 * Get lead status counts
 */
export function getLeadStats() {
  const totalResult = runDb("SELECT COUNT(*) as total FROM leads");
  const verifiedResult = runDb("SELECT COUNT(*) as total FROM leads WHERE status IN ('verified', 'high_intent')");
  const highIntentResult = runDb("SELECT COUNT(*) as total FROM leads WHERE status = 'high_intent'");

  return {
    total: totalResult[0]?.total || 0,
    verified: verifiedResult[0]?.total || 0,
    highIntent: highIntentResult[0]?.total || 0,
  };
}

/**
 * Score a group of leads for frontend display (simulated detailed breakdown)
 */
export function scoreLeads(leads) {
  return leads.map(lead => {
    const score = Math.floor(40 + Math.random() * 60);
    return { ...lead, score };
  });
}