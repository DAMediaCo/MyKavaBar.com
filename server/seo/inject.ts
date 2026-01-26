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
