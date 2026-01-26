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

// Slot 1: The Where & What (10 variations)
const SLOT_1_TEMPLATES = [
  "{{name}} is a premier {{city}} destination for authentic Noble kava and botanical blends.",
  "Located in the heart of {{city}}, {{name}} offers a relaxing, alcohol-free retreat for the local community.",
  "A staple of the {{state}} kava scene, {{name}} specializes in traditional South Pacific roots and wellness.",
  "Found near {{zip}}, {{name}} provides a serene environment perfect for unwinding with a shell.",
  "Serving the greater {{city}} area, {{name}} is a vibrant hub for mindful socializing and island tradition.",
  "Nestled within the {{city}} community, {{name}} brings a taste of the islands to {{state}}.",
  "As a top-rated kava lounge in {{city}}, {{name}} is dedicated to serving high-quality, lab-tested kava.",
  "Situated in a prime {{city}} location, {{name}} is the perfect spot for those seeking a botanical alternative.",
  "{{name}} stands as a dedicated kava bar in {{state}}, offering traditional service in a modern setting.",
  "If you are looking for kava in {{city}}, {{name}} provides an authentic experience rooted in tradition."
];

// Slot 2: The Why & CTA (10 variations)
const SLOT_2_TEMPLATES = [
  "Visit them today to experience the best kava culture in the {{zip}} area.",
  "It remains a top-rated choice for anyone seeking a chill 'Bula' vibe in {{state}}.",
  "Stop by {{name}} to see why it's a favorite for kava drinkers across {{city}}.",
  "Whether you're a regular or a newcomer, it's a must-visit spot in {{state}}.",
  "They continue to set the standard for quality and community in the {{city}} region.",
  "Experience the relaxing benefits of premium kava at this {{city}} staple.",
  "Come by for a shell and discover why {{name}} is a cornerstone of {{state}} kava culture.",
  "The welcoming atmosphere at {{name}} makes it a top destination for the {{zip}} community.",
  "Join the local {{city}} kava community at {{name}} for a truly unique social experience.",
  "Discover your new favorite botanical retreat right here in the heart of {{city}}."
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
 * Generates a unique, deterministic 2-sentence summary for a kava bar
 * Uses slug-based seeding for permanent, consistent output
 * 10x10 = 100 unique combinations for 700+ bars
 * 
 * @param bar - The bar object with name, city, state, zip, and slug/id
 * @returns A 2-sentence summary string (~150-160 chars) for description and meta tag
 */
export function generateBarSummary(bar: BarSummaryInput): string {
  const seed = bar.slug || bar.id?.toString() || bar.name;
  const hash = hashString(seed);
  const rng = seededRandom(hash);
  
  // Pick one from each slot (10x10 = 100 combinations)
  const slot1 = fillTemplate(seededPick(SLOT_1_TEMPLATES, rng), bar);
  const slot2 = fillTemplate(seededPick(SLOT_2_TEMPLATES, rng), bar);
  
  return `${slot1} ${slot2}`;
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
