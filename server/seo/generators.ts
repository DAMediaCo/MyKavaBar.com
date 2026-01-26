/**
 * Server-side SEO generators for kava bar listings
 * These run on the server to inject SEO data into HTML before sending to crawlers
 */

interface BarData {
  id: number;
  name: string;
  address?: string | null;
  phone?: string | null;
  rating?: string | number | null;
  reviewCount?: number;
  heroImageUrl?: string | null;
  vibeText?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  yelpUrl?: string | null;
  websiteUrl?: string | null;
  seoTitle?: string | null;
  location?: { lat?: number; lng?: number } | null;
  hours?: {
    periods?: Array<{ open?: { day: number; time: string }; close?: { day: number; time: string } }>;
    weekday_text?: string[];
  } | null;
}

// ============================================================================
// UNIQUE DESCRIPTION GENERATOR (Seeded Random)
// ============================================================================

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function seededPick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
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

function parseAddress(address: string | null | undefined): { city: string; state: string; zip: string } {
  if (!address) return { city: '', state: '', zip: '' };
  
  const parts = address.split(',').map(s => s.trim());
  const city = parts[1] || '';
  const stateZipPart = parts[2] || '';
  const stateMatch = stateZipPart.match(/^([A-Z]{2})/);
  const zipMatch = stateZipPart.match(/(\d{5})/);
  
  return {
    city,
    state: stateMatch?.[1] || '',
    zip: zipMatch?.[1] || ''
  };
}

function fillTemplate(template: string, name: string, city: string, state: string, zip: string): string {
  return template
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{city\}\}/g, city || 'the area')
    .replace(/\{\{state\}\}/g, state || '')
    .replace(/\{\{zip\}\}/g, zip || 'local');
}

/**
 * Generates a unique, deterministic 2-sentence description for a kava bar
 * Uses slug-based seeding for permanent, consistent output
 * 10x10 = 100 unique combinations for 700+ bars
 * 
 * @param bar - Bar data from database
 * @returns 2-sentence description (~150-160 characters)
 */
export function generateUniqueDescription(bar: BarData): string {
  const slug = bar.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
  const hash = hashString(slug);
  const rng = seededRandom(hash);
  const { city, state, zip } = parseAddress(bar.address);
  
  // Pick one from each slot (10x10 = 100 combinations)
  const slot1 = fillTemplate(seededPick(SLOT_1_TEMPLATES, rng), bar.name, city, state, zip);
  const slot2 = fillTemplate(seededPick(SLOT_2_TEMPLATES, rng), bar.name, city, state, zip);
  
  return `${slot1} ${slot2}`;
}

// ============================================================================
// JSON-LD SCHEMA GENERATOR
// ============================================================================

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const BASE_URL = "https://mykavabar.com";

export function generateKavaSchema(bar: BarData): object {
  const slug = bar.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
  const { city, state, zip } = parseAddress(bar.address);
  const canonicalUrl = `${BASE_URL}/kava-bars/${bar.id}`;
  
  const addressParts = bar.address?.split(',').map(s => s.trim()) || [];
  const street = addressParts[0] || '';
  
  const jsonLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "BarOrPub",
    "@id": `${BASE_URL}/listing/${slug}-${bar.id}#business`,
    "name": bar.name,
    "url": canonicalUrl,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": canonicalUrl
    },
    "logo": `${BASE_URL}/logo.png`,
    "servesCuisine": "Kava, Botanical Drinks",
    "priceRange": "$$"
  };

  if (bar.heroImageUrl) {
    jsonLd.image = bar.heroImageUrl;
  }

  jsonLd.description = generateUniqueDescription(bar);

  if (bar.phone) {
    jsonLd.telephone = bar.phone;
  }

  if (street || city) {
    jsonLd.address = {
      "@type": "PostalAddress",
      "streetAddress": street,
      "addressLocality": city,
      "addressRegion": state,
      "postalCode": zip,
      "addressCountry": "US"
    };
  }

  const location = bar.location as { lat?: number; lng?: number } | null;
  if (location?.lat && location?.lng) {
    jsonLd.geo = {
      "@type": "GeoCoordinates",
      "latitude": location.lat,
      "longitude": location.lng
    };
  }

  if (bar.hours?.periods && bar.hours.periods.length > 0) {
    jsonLd.openingHoursSpecification = bar.hours.periods
      .filter(p => p.open?.time && p.close?.time)
      .map(period => ({
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": DAY_NAMES[period.open!.day] || "Monday",
        "opens": `${period.open!.time.slice(0, 2)}:${period.open!.time.slice(2)}`,
        "closes": `${period.close!.time.slice(0, 2)}:${period.close!.time.slice(2)}`
      }));
  }

  const rating = typeof bar.rating === 'string' ? parseFloat(bar.rating) : bar.rating;
  if (rating && rating > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": rating,
      "bestRating": "5",
      "worstRating": "1"
    };
    if (bar.reviewCount && bar.reviewCount > 0) {
      jsonLd.aggregateRating.reviewCount = bar.reviewCount;
    }
  }

  const sameAs: string[] = [];
  if (bar.facebookUrl) sameAs.push(bar.facebookUrl);
  if (bar.instagramUrl) sameAs.push(bar.instagramUrl);
  if (bar.yelpUrl) sameAs.push(bar.yelpUrl);
  if (bar.websiteUrl) sameAs.push(bar.websiteUrl);
  if (sameAs.length > 0) {
    jsonLd.sameAs = sameAs;
  }

  return jsonLd;
}

// ============================================================================
// SEO TITLE GENERATOR
// ============================================================================

export function generateSeoTitle(bar: BarData): string {
  if (bar.seoTitle) return bar.seoTitle;
  
  const { city, state } = parseAddress(bar.address);
  
  if (!city && !state) {
    return `${bar.name} | Kava Bar - MyKavaBar`;
  }
  if (!state) {
    return `Top Kava Bar in ${city} | ${bar.name}`;
  }
  if (!city) {
    return `Top Kava Bar in ${state} | ${bar.name}`;
  }
  return `Top Kava Bar in ${city}, ${state} | ${bar.name}`;
}
