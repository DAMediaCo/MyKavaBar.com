/**
 * SEO Injection for bar listing pages
 * Injects meta tags, title, and JSON-LD into HTML before sending to crawlers
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
 * Injects SEO data into HTML template for a bar listing page
 */
export function injectBarSeoData(html: string, bar: BarData): string {
  const seoTitle = generateSeoTitle(bar);
  const description = generateUniqueDescription(bar);
  const jsonLd = generateKavaSchema(bar);
  const canonicalUrl = `${BASE_URL}/kava-bars/${bar.id}`;
  const ogImage = bar.heroImageUrl || `${BASE_URL}/og-default.jpg`;

  // Replace title tag
  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(seoTitle)}</title>`
  );

  // Build meta tags to inject
  const metaTags = `
    <meta name="description" content="${escapeHtml(description.substring(0, 160))}">
    <link rel="canonical" href="${canonicalUrl}">
    <meta property="og:title" content="${escapeHtml(seoTitle)}">
    <meta property="og:description" content="${escapeHtml(description.substring(0, 160))}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="${ogImage}">
    <meta property="og:type" content="business.business">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(seoTitle)}">
    <meta name="twitter:description" content="${escapeHtml(description.substring(0, 160))}">
    <meta name="twitter:image" content="${ogImage}">
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  `;

  // Inject meta tags before </head>
  html = html.replace('</head>', `${metaTags}\n</head>`);

  return html;
}

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
