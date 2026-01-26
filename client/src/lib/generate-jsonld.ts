/**
 * Generates JSON-LD structured data for kava bar listings
 * Schema: https://schema.org/BarOrPub with LocalBusiness fallback
 */

export interface BarListing {
  id: number;
  slug?: string;
  name: string;
  address?: string;
  phone?: string;
  rating?: string | number;
  reviewCount?: number;
  heroImageUrl?: string | null;
  vibeText?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  yelpUrl?: string | null;
  websiteUrl?: string | null;
  location?: {
    lat?: number;
    lng?: number;
  } | null;
  hours?: {
    periods?: Array<{
      open?: { day: number; time: string };
      close?: { day: number; time: string };
    }>;
    weekday_text?: string[];
  } | null;
}

export interface JsonLdSchema {
  "@context": string;
  "@type": string;
  "@id": string;
  name: string;
  url: string;
  mainEntityOfPage?: {
    "@type": string;
    "@id": string;
  };
  logo?: string;
  image?: string;
  description?: string;
  servesCuisine?: string;
  priceRange?: string;
  telephone?: string;
  address?: {
    "@type": string;
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
  geo?: {
    "@type": string;
    latitude: number;
    longitude: number;
  };
  openingHoursSpecification?: Array<{
    "@type": string;
    dayOfWeek: string;
    opens: string;
    closes: string;
  }>;
  aggregateRating?: {
    "@type": string;
    ratingValue: string | number;
    bestRating: string;
    worstRating: string;
    reviewCount?: number;
  };
  sameAs?: string[];
}

/**
 * Creates a URL-friendly slug from a bar name (fallback if slug not provided)
 */
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Parses an address string into components
 * Expected format: "Street Address, City, State ZIP, Country"
 */
function parseAddress(address: string): {
  street: string;
  city: string;
  state: string;
  zip: string;
} {
  const parts = address.split(',').map(s => s.trim());
  const street = parts[0] || '';
  const city = parts[1] || '';
  const stateZipPart = parts[2] || '';
  
  const stateZipMatch = stateZipPart.match(/^([A-Z]{2})\s*(\d{5})?/);
  const state = stateZipMatch?.[1] || '';
  const zip = stateZipMatch?.[2] || '';
  
  return { street, city, state, zip };
}

/**
 * Converts Google Places API time format (HHMM) to ISO format (HH:MM)
 */
function formatTime(time: string): string {
  if (!time || time.length < 4) return time;
  return `${time.slice(0, 2)}:${time.slice(2)}`;
}

/**
 * Validates if the listing has enough data for BarOrPub schema
 */
function hasBarOrPubData(listing: BarListing): boolean {
  return !!(
    listing.name &&
    listing.address &&
    (listing.hours?.periods?.length || listing.phone || listing.rating)
  );
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const BASE_URL = "https://mykavabar.com";

/**
 * Generates a JSON-LD schema object for a kava bar listing
 * Falls back to LocalBusiness if BarOrPub-specific data is missing
 * 
 * @param listing - The bar listing data from PostgreSQL
 * @param baseUrl - The base URL for the website (default: https://mykavabar.com)
 * @returns A JSON-LD object ready to be stringified
 */
export function generateBarJsonLd(
  listing: BarListing,
  baseUrl: string = BASE_URL
): JsonLdSchema {
  try {
    // Use existing slug or create one from name
    const slug = listing.slug || createSlug(listing.name);
    const canonicalUrl = `${baseUrl}/listing/${slug}`;
    
    // Determine schema type based on available data
    const schemaType = hasBarOrPubData(listing) ? "BarOrPub" : "LocalBusiness";
    
    const addressParts = listing.address ? parseAddress(listing.address) : null;
    
    const jsonLd: JsonLdSchema = {
      "@context": "https://schema.org",
      "@type": schemaType,
      "@id": `${baseUrl}/listing/${slug}#business`,
      "name": listing.name,
      "url": canonicalUrl,
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": canonicalUrl
      },
      "logo": `${baseUrl}/logo.png`
    };

    // Only add servesCuisine for BarOrPub type
    if (schemaType === "BarOrPub") {
      jsonLd.servesCuisine = "Kava, Botanical Drinks";
      jsonLd.priceRange = "$$";
    }

    // Add image if available
    if (listing.heroImageUrl) {
      jsonLd.image = listing.heroImageUrl;
    }

    // Add description
    if (listing.vibeText) {
      jsonLd.description = listing.vibeText;
    } else if (addressParts) {
      jsonLd.description = `${listing.name} - Kava bar located in ${addressParts.city || 'the US'}${addressParts.state ? `, ${addressParts.state}` : ''}`;
    }

    // Add phone number
    if (listing.phone) {
      jsonLd.telephone = listing.phone;
    }

    // Add structured address
    if (addressParts && (addressParts.street || addressParts.city)) {
      jsonLd.address = {
        "@type": "PostalAddress",
        "streetAddress": addressParts.street,
        "addressLocality": addressParts.city,
        "addressRegion": addressParts.state,
        "postalCode": addressParts.zip,
        "addressCountry": "US"
      };
    }

    // Add geo coordinates from database
    if (listing.location?.lat && listing.location?.lng) {
      jsonLd.geo = {
        "@type": "GeoCoordinates",
        "latitude": listing.location.lat,
        "longitude": listing.location.lng
      };
    }

    // Add opening hours from periods data
    if (listing.hours?.periods && listing.hours.periods.length > 0) {
      const hoursSpec: JsonLdSchema["openingHoursSpecification"] = [];
      
      listing.hours.periods.forEach(period => {
        if (period.open?.time && period.close?.time) {
          hoursSpec.push({
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": DAY_NAMES[period.open.day] || "Monday",
            "opens": formatTime(period.open.time),
            "closes": formatTime(period.close.time)
          });
        }
      });
      
      if (hoursSpec.length > 0) {
        jsonLd.openingHoursSpecification = hoursSpec;
      }
    }

    // Add aggregate rating
    const rating = typeof listing.rating === 'string' ? parseFloat(listing.rating) : listing.rating;
    if (rating && rating > 0) {
      jsonLd.aggregateRating = {
        "@type": "AggregateRating",
        "ratingValue": rating,
        "bestRating": "5",
        "worstRating": "1"
      };
      
      if (listing.reviewCount && listing.reviewCount > 0) {
        jsonLd.aggregateRating.reviewCount = listing.reviewCount;
      }
    }

    // Build sameAs array from social/external links
    const sameAs: string[] = [];
    if (listing.facebookUrl) sameAs.push(listing.facebookUrl);
    if (listing.instagramUrl) sameAs.push(listing.instagramUrl);
    if (listing.yelpUrl) sameAs.push(listing.yelpUrl);
    if (listing.websiteUrl) sameAs.push(listing.websiteUrl);
    
    if (sameAs.length > 0) {
      jsonLd.sameAs = sameAs;
    }

    return jsonLd;
    
  } catch (error) {
    // Error fallback: return minimal LocalBusiness schema
    console.error('Error generating JSON-LD, falling back to LocalBusiness:', error);
    
    const fallbackSlug = listing.slug || createSlug(listing.name || 'unknown');
    
    return {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "@id": `${baseUrl}/listing/${fallbackSlug}#business`,
      "name": listing.name || "Kava Bar",
      "url": `${baseUrl}/listing/${fallbackSlug}`,
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `${baseUrl}/listing/${fallbackSlug}`
      }
    };
  }
}

/**
 * Generates a JSON-LD script string ready to be inserted into HTML
 * @param listing - The bar listing data
 * @param baseUrl - The base URL for the website
 * @returns A complete JSON-LD string
 */
export function generateBarJsonLdString(
  listing: BarListing,
  baseUrl: string = BASE_URL
): string {
  const jsonLd = generateBarJsonLd(listing, baseUrl);
  return JSON.stringify(jsonLd, null, 2);
}

/**
 * Generates a complete script tag with JSON-LD for HTML insertion
 * @param listing - The bar listing data
 * @param baseUrl - The base URL for the website
 * @returns A complete <script> tag string
 */
export function generateBarJsonLdScriptTag(
  listing: BarListing,
  baseUrl: string = BASE_URL
): string {
  const jsonLdString = generateBarJsonLdString(listing, baseUrl);
  return `<script type="application/ld+json">\n${jsonLdString}\n</script>`;
}
