/**
 * SEO Injection for bar listing pages
 * Replaces placeholder comments in HTML with actual SEO data for crawlers
 */

import { generateUniqueDescription, generateKavaSchema, generateSeoTitle } from "./generators";

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
  location?: unknown;
  hours?: unknown;
}

const BASE_URL = "https://mykavabar.com";

/**
 * Escapes HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Injects SEO data into HTML template for a bar listing page
 * Uses placeholder comments (<!-- SSR:TAG -->...<!-- /SSR:TAG -->) for clean replacement
 */
export function injectBarSeoData(html: string, bar: BarData): string {
  const seoTitle = generateSeoTitle(bar);
  const description = generateUniqueDescription(bar);
  const jsonLd = generateKavaSchema(bar);
  const canonicalUrl = `${BASE_URL}/kava-bars/${bar.id}`;
  const ogImage = bar.heroImageUrl || `${BASE_URL}/og-default.jpg`;

  // Replace title (between SSR:TITLE placeholders)
  html = html.replace(
    /<!-- SSR:TITLE -->.*?<!-- \/SSR:TITLE -->/s,
    `<!-- SSR:TITLE --><title>${escapeHtml(seoTitle)}</title><!-- /SSR:TITLE -->`
  );

  // Replace meta description
  html = html.replace(
    /<!-- SSR:META_DESC -->.*?<!-- \/SSR:META_DESC -->/s,
    `<!-- SSR:META_DESC --><meta name="description" content="${escapeHtml(description.substring(0, 160))}"><!-- /SSR:META_DESC -->`
  );

  // Replace canonical URL
  html = html.replace(
    /<!-- SSR:CANONICAL -->.*?<!-- \/SSR:CANONICAL -->/s,
    `<!-- SSR:CANONICAL --><link rel="canonical" href="${canonicalUrl}"><!-- /SSR:CANONICAL -->`
  );

  // Replace Open Graph tags
  const ogTags = `
    <meta property="og:title" content="${escapeHtml(seoTitle)}">
    <meta property="og:description" content="${escapeHtml(description.substring(0, 160))}">
    <meta property="og:type" content="business.business">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="${ogImage}">
    <meta property="og:site_name" content="MyKavaBar">
  `;
  html = html.replace(
    /<!-- SSR:OG_TAGS -->.*?<!-- \/SSR:OG_TAGS -->/s,
    `<!-- SSR:OG_TAGS -->${ogTags}<!-- /SSR:OG_TAGS -->`
  );

  // Replace Twitter tags
  const twitterTags = `
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(seoTitle)}">
    <meta name="twitter:description" content="${escapeHtml(description.substring(0, 160))}">
    <meta name="twitter:image" content="${ogImage}">
  `;
  html = html.replace(
    /<!-- SSR:TWITTER_TAGS -->.*?<!-- \/SSR:TWITTER_TAGS -->/s,
    `<!-- SSR:TWITTER_TAGS -->${twitterTags}<!-- /SSR:TWITTER_TAGS -->`
  );

  // Replace JSON-LD schema
  html = html.replace(
    /<!-- SSR:JSON_LD -->.*?<!-- \/SSR:JSON_LD -->/s,
    `<!-- SSR:JSON_LD --><script type="application/ld+json">${JSON.stringify(jsonLd)}</script><!-- /SSR:JSON_LD -->`
  );

  return html;
}

// ============================================================================
// STATE & CITY PAGE SEO INJECTION
// ============================================================================

const SEO_BASE_URL = "https://mykavabar.com";

const LOCATION_STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
  CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",
  HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",
  KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",
  MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",
  MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",
  NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",
  OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",
  SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",
  VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming"
};

export const SLUG_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(LOCATION_STATE_NAMES).map(([code, name]) =>
    [name.toLowerCase().replace(/\s+/g, "-"), code]
  )
);

export function slugToStateCode(slug: string): string | null {
  return SLUG_TO_CODE[slug.toLowerCase()] ?? null;
}

export function getLocationStateName(code: string): string {
  return LOCATION_STATE_NAMES[code.toUpperCase()] ?? code;
}

function replaceSeoPlaceholders(html: string, fields: {
  title: string; description: string; canonical: string; jsonLd: object;
}): string {
  const { title, description, canonical, jsonLd } = fields;
  const esc = escapeHtml;
  html = html.replace(/<!-- SSR:TITLE -->.*?<!-- \/SSR:TITLE -->/s,
    `<!-- SSR:TITLE --><title>${esc(title)}</title><!-- /SSR:TITLE -->`);
  html = html.replace(/<!-- SSR:META_DESC -->.*?<!-- \/SSR:META_DESC -->/s,
    `<!-- SSR:META_DESC --><meta name="description" content="${esc(description.substring(0, 160))}"><!-- /SSR:META_DESC -->`);
  html = html.replace(/<!-- SSR:CANONICAL -->.*?<!-- \/SSR:CANONICAL -->/s,
    `<!-- SSR:CANONICAL --><link rel="canonical" href="${esc(canonical)}"><!-- /SSR:CANONICAL -->`);
  html = html.replace(/<!-- SSR:OG_TAGS -->.*?<!-- \/SSR:OG_TAGS -->/s,
    `<!-- SSR:OG_TAGS --><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description.substring(0, 160))}"><meta property="og:type" content="website"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${SEO_BASE_URL}/og-default.jpg"><!-- /SSR:OG_TAGS -->`);
  html = html.replace(/<!-- SSR:TWITTER_TAGS -->.*?<!-- \/SSR:TWITTER_TAGS -->/s,
    `<!-- SSR:TWITTER_TAGS --><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description.substring(0, 160))}"><!-- /SSR:TWITTER_TAGS -->`);
  html = html.replace(/<!-- SSR:JSON_LD -->.*?<!-- \/SSR:JSON_LD -->/s,
    `<!-- SSR:JSON_LD --><script type="application/ld+json">${JSON.stringify(jsonLd)}</script><!-- /SSR:JSON_LD -->`);
  return html;
}

export function injectStateSeoData(html: string, stateCode: string, barCount: number, cities: string[]): string {
  const stateName = getLocationStateName(stateCode);
  const stateSlug = stateName.toLowerCase().replace(/\s+/g, "-");
  const title = `Kava Bars in ${stateName} | MyKavaBar`;
  const description = `Find the best kava bars in ${stateName}. Browse ${barCount} kava bars across ${cities.length} cities with hours, ratings, and directions.`;
  const canonical = `${SEO_BASE_URL}/kava-bars/${stateSlug}`;
  const jsonLd = {
    "@context": "https://schema.org", "@type": "ItemList",
    "name": `Kava Bars in ${stateName}`, "description": description,
    "url": canonical, "numberOfItems": barCount,
    "itemListElement": cities.slice(0, 20).map((city, i) => ({
      "@type": "ListItem", "position": i + 1,
      "name": `Kava Bars in ${city}, ${stateName}`,
      "item": `${SEO_BASE_URL}/kava-bars/${stateSlug}/${city.toLowerCase().replace(/\s+/g, "-")}`
    }))
  };
  return replaceSeoPlaceholders(html, { title, description, canonical, jsonLd });
}

export function injectCitySeoData(html: string, stateCode: string, city: string, barCount: number): string {
  const stateName = getLocationStateName(stateCode);
  const stateSlug = stateName.toLowerCase().replace(/\s+/g, "-");
  const citySlug = city.toLowerCase().replace(/\s+/g, "-");
  const cityDisplay = city.replace(/\b\w/g, c => c.toUpperCase());
  const title = `Kava Bars in ${cityDisplay}, ${stateName} | MyKavaBar`;
  const description = `Find the best kava bars in ${cityDisplay}, ${stateName}. Browse ${barCount} kava bars with hours, ratings, and directions.`;
  const canonical = `${SEO_BASE_URL}/kava-bars/${stateSlug}/${citySlug}`;
  const jsonLd = {
    "@context": "https://schema.org", "@type": "ItemList",
    "name": `Kava Bars in ${cityDisplay}, ${stateName}`, "description": description,
    "url": canonical, "numberOfItems": barCount
  };
  return replaceSeoPlaceholders(html, { title, description, canonical, jsonLd });
}
