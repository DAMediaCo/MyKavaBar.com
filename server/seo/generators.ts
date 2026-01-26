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

export function generateUniqueDescription(bar: BarData): string {
  const slug = bar.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
  const hash = hashString(slug);
  const rng = seededRandom(hash);
  const { city, state, zip } = parseAddress(bar.address);
  
  const intro = fillTemplate(seededPick(INTRO_TEMPLATES, rng), bar.name, city, state, zip);
  const middle = fillTemplate(seededPick(MIDDLE_TEMPLATES, rng), bar.name, city, state, zip);
  const end = fillTemplate(seededPick(END_TEMPLATES, rng), bar.name, city, state, zip);
  
  return `${intro} ${middle} ${end}`;
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
