/**
 * Generates a unique, deterministic 3-sentence summary for kava bar listings
 * Uses slug-based seeding to ensure consistency across page refreshes
 */

interface BarSummaryInput {
  name: string;
  city?: string;
  state?: string;
  zip?: string;
  slug?: string;
  id?: number;
}

/**
 * Simple hash function to convert a string to a number seed
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Seeded random number generator (Mulberry32)
 * Returns a function that generates deterministic random numbers 0-1
 */
function seededRandom(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Picks a random item from an array using the seeded RNG
 */
function seededPick<T>(arr: T[], rng: () => number): T {
  const index = Math.floor(rng() * arr.length);
  return arr[index];
}

const INTRO_TEMPLATES = [
  "Nestled in the heart of {{city}}, {{name}} offers an authentic kava experience for locals and travelers alike.",
  "Welcome to {{name}}, a beloved kava lounge serving the {{city}} community with traditional island hospitality.",
  "Discover {{name}} in {{city}}, {{state}} — your destination for premium kava and genuine relaxation.",
  "{{name}} brings the spirit of the Pacific Islands to {{city}}, offering a serene escape from everyday life.",
  "Located in {{city}}, {{name}} has become a gathering place for kava enthusiasts seeking quality and connection.",
  "Experience the warmth of {{name}}, where {{city}} locals come together to enjoy the finest kava traditions.",
  "{{name}} stands as a cornerstone of the {{city}} kava scene, welcoming guests with open arms."
];

const MIDDLE_TEMPLATES = [
  "Their menu features noble kava blends sourced directly from the South Pacific islands.",
  "Guests enjoy a carefully curated selection of traditional and flavored kava preparations.",
  "The bar serves both newcomers and seasoned kava drinkers with patience and expertise.",
  "Known for their smooth, high-quality kava, they prioritize authenticity in every shell.",
  "The atmosphere blends modern comfort with traditional island vibes for a unique experience.",
  "Beyond kava, they offer botanical drinks and a welcoming space to unwind and connect.",
  "Their knowledgeable staff guides visitors through the kava journey, from first sip to regular patron."
];

const END_TEMPLATES = [
  "A true staple of the {{zip}} area, {{name}} continues to grow the kava culture one shell at a time.",
  "Whether you're a kava veteran or curious newcomer, {{name}} in {{state}} welcomes all who seek relaxation.",
  "Stop by {{name}} and discover why it's become a favorite gathering spot in {{city}}, {{state}}.",
  "Join the {{name}} ohana and experience the calming traditions that have made kava beloved worldwide.",
  "{{name}} invites you to slow down, connect, and savor the peaceful moments that kava brings.",
  "Visit {{name}} in the {{zip}} area to find your new favorite spot for kava and community.",
  "From first-timers to regulars, everyone finds a home at {{name}} in {{city}}."
];

/**
 * Replaces template placeholders with actual bar data
 */
function fillTemplate(template: string, bar: BarSummaryInput): string {
  return template
    .replace(/\{\{name\}\}/g, bar.name)
    .replace(/\{\{city\}\}/g, bar.city || 'the area')
    .replace(/\{\{state\}\}/g, bar.state || '')
    .replace(/\{\{zip\}\}/g, bar.zip || 'local');
}

/**
 * Generates a unique, deterministic 3-sentence summary for a kava bar
 * The summary is seeded by the bar's slug or id, ensuring it never changes on refresh
 * 
 * @param bar - The bar object with name, city, state, zip, and slug/id
 * @returns A 3-sentence summary string for use as description and meta tag
 */
export function generateBarSummary(bar: BarSummaryInput): string {
  const seed = bar.slug || bar.id?.toString() || bar.name;
  const hash = hashString(seed);
  const rng = seededRandom(hash);
  
  const intro = fillTemplate(seededPick(INTRO_TEMPLATES, rng), bar);
  const middle = fillTemplate(seededPick(MIDDLE_TEMPLATES, rng), bar);
  const end = fillTemplate(seededPick(END_TEMPLATES, rng), bar);
  
  return `${intro} ${middle} ${end}`;
}

/**
 * Generates a shorter summary for meta descriptions (under 160 chars recommended)
 */
export function generateBarMetaSummary(bar: BarSummaryInput): string {
  const fullSummary = generateBarSummary(bar);
  if (fullSummary.length <= 160) return fullSummary;
  
  const seed = bar.slug || bar.id?.toString() || bar.name;
  const hash = hashString(seed);
  const rng = seededRandom(hash);
  
  const intro = fillTemplate(seededPick(INTRO_TEMPLATES, rng), bar);
  return intro.length <= 160 ? intro : intro.substring(0, 157) + '...';
}
