/**
 * Static template data for the bee chain, ported verbatim from the prototype
 * (scraper-bee / strategist-bee / writer-bee). Keeping these together makes the
 * engines pure logic over shared constants.
 */

export const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  Roofing: ['Roofing', 'Roof', 'Leak Repair', 'Gutter', 'Shingle', 'Rooftop'],
  Plumbing: ['Plumbing', 'Pipe', 'Drain', 'Water Heater', 'Septic', 'Hydro'],
  HVAC: ['HVAC', 'Heating', 'Cooling', 'Air Conditioning', 'Furnace', 'Climate'],
  Electrical: ['Electrical', 'Electric', 'Wiring', 'Circuit', 'Solar', 'Generator'],
  Landscaping: ['Landscaping', 'Lawn', 'Garden', 'Tree', 'Irrigation', 'Hardscape'],
  'General Contracting': ['Construction', 'Contracting', 'Builders', 'Remodeling', 'Renovation'],
};

export const VALID_INDUSTRIES = Object.keys(INDUSTRY_KEYWORDS) as [string, ...string[]];

export const FIRST_NAMES = [
  'James', 'Maria', 'Robert', 'Jennifer', 'Michael', 'Linda', 'David', 'Sarah',
  'William', 'Jessica', 'Richard', 'Karen', 'Joseph', 'Nancy', 'Thomas', 'Lisa',
  'Chris', 'Betty', 'Daniel', 'Margaret', 'Paul', 'Sandra', 'Mark', 'Ashley',
  'Donald', 'Dorothy', 'George', 'Kimberly', 'Kenneth', 'Emily', 'Steven', 'Amy',
];

export const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
];

export const ANGLES = [
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

export const BUSINESS_SUFFIXES = [
  'Pro', 'Experts', 'Services', 'Solutions', 'Masters', 'Team', 'Co', 'LLC', 'Group', 'Specialists',
];

export const STRATEGIES: Record<string, string[]> = {
  Roofing: [
    'Offer a free drone roof inspection after recent storms in {region} — no-obligation estimate.',
    'Send a "Winter is coming" maintenance checklist to {region} homeowners with aging roofs.',
    'Run a "Neighbor Referral" campaign in {region}: $250 off for every referred signed roof.',
    'Target {region} real estate agents for pre-listing roof certifications — speed up closings.',
    'Post-storm emergency tarping service outreach in {region} — 30-minute response time.',
  ],
  Plumbing: [
    'Offer a free water pressure test in {region} — identify hidden leaks before they burst.',
    'Send seasonal pipe-insulation reminders to {region} homeowners before winter freeze.',
    'Run a "Senior Discount" campaign in {region}: 15% off for 65+ homeowners.',
    'Target {region} property managers with annual plumbing inspection contracts.',
    'Same-day emergency service outreach in {region} — no overtime fees for new customers.',
  ],
  HVAC: [
    'Offer a free AC efficiency audit in {region} — save up to 30% on summer cooling bills.',
    'Send "furnace tune-up" postcards to {region} homes with units over 10 years old.',
    'Run a "Filter Subscription" campaign in {region}: quarterly filter delivery + system check.',
    'Target {region} newly built homes for HVAC warranty registration follow-ups.',
    'Pre-summer AC maintenance special in {region}: $89 tune-up (normally $149).',
  ],
  Electrical: [
    'Offer a free home safety inspection in {region} — knob-and-tube wiring identification.',
    'Send EV charger installation promos to {region} homeowners who recently bought EVs.',
    'Run a "Smart Home Bundle" campaign in {region} — lights, thermostat, lock installation.',
    'Target {region} kitchen remodelers for electrical upgrade partnership referrals.',
    'Generator backup power consultation in {region} — be ready for the next blackout.',
  ],
  Landscaping: [
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

interface ScriptTemplate {
  opener: string[];
  body: string[];
  closer: string[];
}

export const SCRIPTS: Record<string, ScriptTemplate> = {
  Roofing: {
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
  Plumbing: {
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
  HVAC: {
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
  Electrical: {
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
  Landscaping: {
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

export const BOUNCEBACK_TEMPLATES = [
  "Hey, sorry I missed your call! Just saw you were looking for {industry} services in {region}. How can I help? - {business_name}",
  "Sorry I couldn't pick up! Were you calling about {industry} work in {region}? Text me back and I'll get right on it. - {business_name}",
  "Missed your call! If you need {industry} help in {region}, I'm your person. Shoot me a text and I'll call you right back. - {business_name}",
  "Hey! Sorry I missed you. Need {industry} services in {region}? Let me know what you need and I'll send over a quote ASAP. - {business_name}",
  "Just missed you! Were you calling about {industry} in {region}? Text me back and I'll squeeze you in this week. - {business_name}",
];

export const SAMPLE_INCOMING = [
  '(510) 555-0199',
  '(415) 555-0234',
  '(925) 555-0412',
  '(510) 555-0387',
  '(707) 555-0165',
  '(408) 555-0921',
  '(209) 555-0743',
];
