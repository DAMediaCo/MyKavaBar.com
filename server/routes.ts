
import { sendPasswordResetEmail, sendNotificationEmail } from "./email";
import type { Express, Request, Response } from "express";
import { type Server } from "http";
import fetch from "node-fetch";
import { isAuthenticated, isPhoneVerifiedMiddleware } from "./middleware/auth";
import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { executeWithRetry } from "@db/connection";
import moment from "moment-timezone";
import {
  createFeature,
  deleteFeature,
  getCategories,
  getFeaturesByCategory,
  updateFeature,
  createBarFeature,
  updateBarFeature,
  deleteBarFeature,
  getBarFeatures,
  getOwnerBarFeatures,
  updateMasterFeaturesForBarOwner,
  toggleFavoriteFeatures,
} from "./controllers/features";
import {
  getHappyHoursController,
  updateHappyHoursController,
} from "./controllers/happy-hours";
// Importing controllers
import {
  rsvpToEvent,
  getMyRsvps,
  deleteRsvp,
  getBarRsvpStats,
} from "./controllers/rsvp";
import {
  checkin,
  getPassport,
  getLeaderboard,
  getBadges,
} from "./controllers/passport";
import {
  kavaBars,
  userFavorites,
  verificationRequests,
  users,
  userActivityLogs,
  verificationCodes,
  barStaff,
  kavatenderReferralProfiles,
  kavatenders,
  kavaBarPhotos,
  barOwnerNotificationPreferences,
  passwordResetTokens,
  checkIns,
  barEvents,
  eventRsvps,
} from "@db/schema";
import { crypto } from "./utils/crypto";
import { eq, and, or, isNull, desc, ne, sql, gt, lt, inArray, gte } from "drizzle-orm";
import { setupWebSocket, notifyAdmins } from "./websocket";
import { fetchKavaBars } from "./scripts/fetch-kava-bars";
import { setupAuth } from "./auth";
import { setupSquareRoutes } from "./square";
import * as path from "path";
import { mkdir } from "fs/promises";
import fs from "node:fs/promises";
import phoneRoutes from "./routes/phone";
import reviewRoutes from "./routes/reviews";
import adminRoutes from "./routes/admin";
import { registerEventRoutes } from "./routes/events";
import multer from "multer";
import sharp from "sharp";
import { randomUUID } from "crypto";
import express from "express";
import { uploadImageToStorage } from "./upload-to-storage";
import { enrichBarData } from "./services/ai-enrichment";
import { parseHours } from "./utils/parse-hours";
import { getUserReferralDetails } from "@utils/referrals";
import { generateUniqueReferralCode } from "@utils/generate-referralcode";
import { requireAdmin } from "./middleware/admin";
import { differenceInDays, startOfDay } from "date-fns";
import { injectBarSeoData, injectStateSeoData, injectCitySeoData, slugToStateCode, getLocationStateName } from "./seo/inject";
import { readFileSync } from "fs";

// Handle the user type
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      points: number;
      isAdmin: boolean;
      squareCustomerId: string | null;
      createdAt: Date;
      phoneNumber: string | null;
      isPhoneVerified: boolean;
      role: string; // Added role field
    }
  }
}

// Utility function to log hours data
function logHoursData(bar: any) {
  console.log("Hours data for bar:", {
    barId: bar.id,
    barName: bar.name,
    hours: bar.hours,
    hoursType: typeof bar.hours,
    isArray: Array.isArray(bar.hours),
    parsedHours:
      typeof bar.hours === "string" ? JSON.parse(bar.hours) : bar.hours,
  });
}

// Utility function to parse hours
function parseBarHours(hours: any) {
  if (!hours) return null;

  try {
    // If it's already a properly formatted object with hours_available, return it
    if (
      typeof hours === "object" &&
      !Array.isArray(hours) &&
      hours.hours_available !== undefined
    ) {
      return hours;
    }

    // If it's a string, try to parse it
    if (typeof hours === "string") {
      const parsed = JSON.parse(hours);
      // If parsed result is already in correct format, return it
      if (parsed.hours_available !== undefined) {
        return parsed;
      }
      // If it's an array, convert to proper format
      if (Array.isArray(parsed)) {
        return {
          weekday_text: parsed,
          open_now: true,
          periods: [],
          hours_available: true,
        };
      }
    }

    // If it's an array, convert to proper format
    if (Array.isArray(hours)) {
      return {
        weekday_text: hours,
        open_now: true,
        periods: [],
        hours_available: true,
      };
    }

    // If none of the above, return null
    console.log("Unable to parse hours format:", hours);
    return null;
  } catch (error) {
    console.error("Error parsing hours:", error);
    return null;
  }
}

const googleMapsClient = new Client({});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
});
let wss: any;
export function registerRoutes(app: Express, server: Server): void {

  // ── Location API routes ───────────────────────────────────────────────────

  app.get("/api/location/states/:stateSlug/bars", async (req: Request, res: Response) => {
    try {
      const stateCode = slugToStateCode(req.params.stateSlug);
      if (!stateCode) return res.status(404).json({ error: "State not found" });
      const result = await db.execute(sql`
        SELECT id, name, address, phone, rating, is_verified_kava_bar, business_status,
               hero_image_url, vibe_text, location, hours
        FROM kava_bars
        WHERE deleted_at IS NULL AND address ILIKE ${'%, ' + stateCode + '%'}
        ORDER BY is_verified_kava_bar DESC, rating DESC NULLS LAST
        LIMIT 200
      `);
      res.json(result.rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/location/states/:stateSlug/cities", async (req: Request, res: Response) => {
    try {
      const stateCode = slugToStateCode(req.params.stateSlug);
      if (!stateCode) return res.status(404).json({ error: "State not found" });
      const result = await db.execute(sql`
        SELECT TRIM(SPLIT_PART(address, ',', 2)) as city, COUNT(*) as bar_count
        FROM kava_bars
        WHERE deleted_at IS NULL AND address ILIKE ${'%, ' + stateCode + '%'}
        GROUP BY city
        HAVING TRIM(SPLIT_PART(address, ',', 2)) != ''
        ORDER BY bar_count DESC
        LIMIT 50
      `);
      res.json((result.rows as any[])
        .filter((r: any) => r.city && r.city.length > 1)
        .map((r: any) => ({
          city: r.city,
          city_slug: r.city.toLowerCase().replace(/\s+/g, "-"),
          bar_count: parseInt(r.bar_count)
        })));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/location/states/:stateSlug/cities/:citySlug/bars", async (req: Request, res: Response) => {
    try {
      const stateCode = slugToStateCode(req.params.stateSlug);
      if (!stateCode) return res.status(404).json({ error: "State not found" });
      const cityName = req.params.citySlug.replace(/-/g, " ");
      const result = await db.execute(sql`
        SELECT id, name, address, phone, rating, is_verified_kava_bar, business_status,
               hero_image_url, vibe_text, location, hours
        FROM kava_bars
        WHERE deleted_at IS NULL AND address ILIKE ${'%, ' + stateCode + '%'}
          AND address ILIKE ${'%' + cityName + '%'}
        ORDER BY is_verified_kava_bar DESC, rating DESC NULLS LAST
        LIMIT 100
      `);
      res.json(result.rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Location page SSR routes (meta injection for Google) ─────────────────

  app.get("/kava-bars/:stateSlug/:citySlug", async (req, res, next) => {
    if (req.headers.accept?.includes("application/json")) return next();
    const stateCode = slugToStateCode(req.params.stateSlug);
    if (!stateCode) return next();
    try {
      const cityName = req.params.citySlug.replace(/-/g, " ");
      const countRes = await db.execute(sql`
        SELECT COUNT(*) as n FROM kava_bars
        WHERE deleted_at IS NULL AND address ILIKE ${'%, ' + stateCode + '%'}
          AND address ILIKE ${'%' + cityName + '%'}
      `);
      const barCount = parseInt((countRes.rows[0] as any).n) || 0;
      const isDev = process.env.NODE_ENV !== "production";
      const indexPath = isDev
        ? path.join(process.cwd(), "client", "index.html")
        : path.join(process.cwd(), "dist", "public", "index.html");
      let html = readFileSync(indexPath, "utf-8");
      html = injectCitySeoData(html, stateCode, cityName, barCount);
      res.status(200).set({ "Content-Type": "text/html" }).send(html);
    } catch { next(); }
  });

  app.get("/kava-bars/:stateSlug", async (req, res, next) => {
    if (req.headers.accept?.includes("application/json")) return next();
    if (!isNaN(parseInt(req.params.stateSlug))) return next();
    const stateCode = slugToStateCode(req.params.stateSlug);
    if (!stateCode) return next();
    try {
      const [countRes, citiesRes] = await Promise.all([
        db.execute(sql`SELECT COUNT(*) as n FROM kava_bars WHERE deleted_at IS NULL AND address ILIKE ${'%, ' + stateCode + '%'}`),
        db.execute(sql`
          SELECT TRIM(SPLIT_PART(address, ',', 2)) as city
          FROM kava_bars WHERE address ILIKE ${'%, ' + stateCode + '%'}
          GROUP BY city ORDER BY COUNT(*) DESC LIMIT 20
        `)
      ]);
      const barCount = parseInt((countRes.rows[0] as any).n) || 0;
      const cities = (citiesRes.rows as any[]).map((r: any) => r.city).filter(Boolean);
      const isDev = process.env.NODE_ENV !== "production";
      const indexPath = isDev
        ? path.join(process.cwd(), "client", "index.html")
        : path.join(process.cwd(), "dist", "public", "index.html");
      let html = readFileSync(indexPath, "utf-8");
      html = injectStateSeoData(html, stateCode, barCount, cities);
      res.status(200).set({ "Content-Type": "text/html" }).send(html);
    } catch { next(); }
  });

  // SEO Route Handler - Injects meta tags for crawlers on bar listing pages
  app.get("/kava-bars/:id", async (req, res, next) => {
    const barId = parseInt(req.params.id);
    
    // Skip if not a valid ID or if it's an API request
    if (isNaN(barId) || req.headers.accept?.includes('application/json')) {
      return next();
    }
    
    try {
      const [bar] = await db
        .select()
        .from(kavaBars)
        .where(eq(kavaBars.id, barId))
        .limit(1);
      
      if (!bar) {
        return next(); // Let normal SPA routing handle 404
      }
      
      // Determine the correct index.html path based on environment
      const isDev = process.env.NODE_ENV !== 'production';
      const indexPath = isDev 
        ? path.join(process.cwd(), 'client', 'index.html')
        : path.join(process.cwd(), 'dist', 'public', 'index.html');
      
      // Read the HTML template
      let html = readFileSync(indexPath, 'utf-8');
      
      // Inject SEO data
      html = injectBarSeoData(html, bar);
      
      res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
    } catch (error) {
      console.error('SEO injection error:', error);
      next(); // Fall back to normal SPA routing on error
    }
  });

  // Robots.txt for SEO and AI crawlers
  app.get("/robots.txt", (req, res) => {
    const robotsTxt = `# MyKavaBar.com Robots.txt
# Allow all crawlers including AI bots

User-agent: *
Allow: /

# Disallow administrative and private routes
Disallow: /admin
Disallow: /api/
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /reset-password

# Allow specific API routes for SEO (bar data)
Allow: /kava-bars/

# Sitemap location
Sitemap: https://mykavabar.com/sitemap.xml
`;
    res.set("Content-Type", "text/plain");
    res.send(robotsTxt);
  });

  // Dynamic Sitemap.xml for SEO
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const BASE_URL = "https://mykavabar.com";
      
      // Fetch all bar IDs (efficient query - only needed columns)
      const bars = await db
        .select({
          id: kavaBars.id
        })
        .from(kavaBars)
        .orderBy(kavaBars.id);
      
      // Static pages
      const staticPages = [
        { url: "/", priority: "1.0", changefreq: "daily" },
        { url: "/about", priority: "0.6", changefreq: "monthly" },
        { url: "/search", priority: "0.9", changefreq: "daily" },
        { url: "/contact", priority: "0.5", changefreq: "monthly" }
      ];
      
      // Build XML
      const today = new Date().toISOString().split('T')[0];
      
      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
      
      // Add static pages
      for (const page of staticPages) {
        xml += `  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
      }
      
      // Add state location pages
      const stateResult = await db.execute(sql`
        SELECT DISTINCT TRIM(SPLIT_PART(address, ',', 3)) as state_part
        FROM kava_bars
        WHERE deleted_at IS NULL AND address IS NOT NULL
      `);
      const STATE_NAMES: Record<string, string> = {
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
      const seenStates = new Set<string>();
      for (const row of stateResult.rows as any[]) {
        const match = (row.state_part || "").match(/^([A-Z]{2})/);
        if (!match) continue;
        const code = match[1];
        if (!STATE_NAMES[code] || seenStates.has(code)) continue;
        seenStates.add(code);
        const slug = STATE_NAMES[code].toLowerCase().replace(/\s+/g, "-");
        xml += `  <url>
    <loc>${BASE_URL}/kava-bars/${slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
`;
      }

      // Add city location pages
      const cityResult = await db.execute(sql`
        SELECT TRIM(SPLIT_PART(address, ',', 2)) as city,
               TRIM(SPLIT_PART(address, ',', 3)) as state_part
        FROM kava_bars
        WHERE deleted_at IS NULL AND address IS NOT NULL
        GROUP BY city, state_part
        HAVING COUNT(*) >= 1
      `);
      for (const row of cityResult.rows as any[]) {
        const match = (row.state_part || "").match(/^([A-Z]{2})/);
        if (!match || !row.city || row.city.length < 2) continue;
        const code = match[1];
        if (!STATE_NAMES[code]) continue;
        const stateSlug = STATE_NAMES[code].toLowerCase().replace(/\s+/g, "-");
        const citySlug = row.city.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        if (!citySlug) continue;
        xml += `  <url>
    <loc>${BASE_URL}/kava-bars/${stateSlug}/${citySlug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
      }

      // Add dynamic bar pages
      for (const bar of bars) {
        xml += `  <url>
    <loc>${BASE_URL}/kava-bars/${bar.id}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
      }
      
      xml += `</urlset>`;
      
      res.set("Content-Type", "application/xml");
      res.send(xml);
    } catch (error) {
      console.error("Sitemap generation error:", error);
      res.status(500).send("Error generating sitemap");
    }
  });

  // Set up authentication first
  setupAuth(app);
  setupSquareRoutes(app);
  // Add phone verification routes
  app.use(phoneRoutes);
  // Add review routes
  app.use(reviewRoutes);
  // Add admin routes
  app.use("/api/admin", adminRoutes);
  // Register event routes
  registerEventRoutes(app);
  app.use((req, res, next) => {
    console.log(`[Incoming] ${req.method} ${req.originalUrl}`);
    console.log("Body:", req.body);
    next();
  });

  // Set up WebSocket server with error handling
  try {
    wss = setupWebSocket(app, server);
    console.log("WebSocket server initialized successfully");
  } catch (error) {
    console.error("Error setting up WebSocket server:", error);
  }

  // Set up static file serving for uploads directory
  const uploadsPath = path.join(process.cwd(), "public", "uploads");
  console.log("Setting up static file serving for uploads at:", uploadsPath);
  try {
    // Ensure uploads directory exists
    mkdir(uploadsPath, { recursive: true })
      .then(() => {
        app.use("/uploads", express.static(uploadsPath));
        console.log("Static file serving configured successfully");
      })
      .catch((error) => {
        console.error("Error setting up static file serving:", error);
      });
  } catch (error) {
    console.error("Error setting up static file serving:", error);
  }

  // Add proxy route for map tiles
  app.get("/api/map-tiles/:z/:x/:y", async (req, res) => {
    const { z, x, y } = req.params;
    try {
      const response = await fetch(
        `https://a.basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`,
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch tile: ${response.statusText}`);
      }

      // Forward the content type
      res.set("Content-Type", response.headers.get("content-type"));
      res.set("Cache-Control", "public, max-age=86400"); // Cache for 24 hours

      // Pipe the response directly to our response
      response.body.pipe(res);
    } catch (error) {
      console.error("Tile proxy error:", error);
      res.status(500).send("Failed to load map tile");
    }
  });

  // Add routes below

  // ── Mobile app aliases ────────────────────────────────────────────────────
  // Mobile app calls /api/bars (not /api/kava-bars), /api/bars/:id, and /api/bars/:id/photos
  // These must be registered BEFORE the /:id routes to avoid interception.

  // GET /api/bars/:id/photos  (before bar-detail to avoid route interception)
  app.get(["/api/bars/:id/photos", "/api/kava-bars/:id/photos"], async (req, res) => {
    try {
      const barId = Number(req.params.id);
      const photos = await db.query.kavaBarPhotos.findMany({
        where: eq(kavaBarPhotos.barId, barId),
        orderBy: desc(kavaBarPhotos.createdAt),
      });
      res.json(photos);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/kava-bars/featured  (nearby bars sorted by distance)
  app.get(["/api/kava-bars/featured", "/api/bars/featured"], async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const limit = parseInt(req.query.limit as string) || 10;
      const bars = await db.execute(sql`
        SELECT k.id, k.name, k.address, k.phone, k.rating, k.is_sponsored,
               k.verification_status, k.hero_image_url, k.location, k.hours, k.business_status,
               (SELECT url FROM kava_bar_photos WHERE bar_id = k.id ORDER BY created_at DESC LIMIT 1) as latest_gallery_photo
        FROM kava_bars k
        WHERE k.verification_status != 'not_kava_bar' AND k.verification_status IS NOT NULL
          AND (k.business_status IS NULL OR k.business_status = 'OPERATIONAL')
          AND k.deleted_at IS NULL
          AND k.is_sponsored = true
        ORDER BY k.rating DESC NULLS LAST LIMIT 200
      `);
      let result = bars.rows.map((bar: any) => {
        let loc = bar.location;
        if (typeof loc === "string") { try { loc = JSON.parse(loc); } catch { loc = null; } }
        let distance: number | null = null;
        if (!isNaN(lat) && !isNaN(lng) && loc?.lat && loc?.lng) {
          const R = 3958.8;
          const dLat = (loc.lat - lat) * Math.PI / 180;
          const dLng = (loc.lng - lng) * Math.PI / 180;
          const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180)*Math.cos(loc.lat*Math.PI/180)*Math.sin(dLng/2)**2;
          distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        }
        return { ...bar, location: loc, distance, heroImageUrl: bar.hero_image_url || null, latestGalleryPhoto: bar.latest_gallery_photo || null };
      });
      if (!isNaN(lat) && !isNaN(lng)) {
        result = result.filter((b: any) => b.distance !== null).sort((a: any, b: any) => (a.distance ?? 999) - (b.distance ?? 999));
      }
      res.json(result.slice(0, limit));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(["/api/kava-bars", "/api/bars"], async (req: Request, res: Response) => {
    try {
      console.log("Fetching all kava bars with connection management...");
      const userId = req.user?.id || null;
      
      // Parse location params for distance filtering
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = parseFloat(req.query.radius as string) || 50; // default 50 miles

      // await sendNotificationEmail("david@mykavabar.com");

      // Define a fallback dataset in case database is unavailable
      const fallbackBars = [
        {
          id: 1,
          name: "Bula on the Beach",
          address: "2525 S Atlantic Ave, Daytona Beach Shores, FL 32118",
          location: { lat: 29.155904, lng: -80.972269 },
          rating: 4.8,
          phone: "(386) 310-4815",
          website: "https://www.bulaonthebeach.com",
          verification_status: "verified_kava_bar",
          owner_id: null,
          is_sponsored: true,
          hours: {
            weekday_text: [
              "Monday: 11:00 AM – 12:00 AM",
              "Tuesday: 11:00 AM – 12:00 AM",
              "Wednesday: 11:00 AM – 12:00 AM",
              "Thursday: 11:00 AM – 12:00 AM",
              "Friday: 11:00 AM – 2:00 AM",
              "Saturday: 11:00 AM – 2:00 AM",
              "Sunday: 11:00 AM – 12:00 AM",
            ],
            open_now: true,
            periods: [],
            hours_available: true,
          },
        },
        {
          id: 2,
          name: "MITRA Kava Bar",
          address: "140 Magnolia Ave, Daytona Beach, FL 32114",
          location: { lat: 29.21098, lng: -81.02214 },
          rating: 4.7,
          phone: "(386) 238-9941",
          website: "https://mitrakavabar.com",
          verification_status: "verified_kava_bar",
          owner_id: null,
          is_sponsored: true,
          hours: {
            weekday_text: [
              "Monday: 12:00 PM – 10:00 PM",
              "Tuesday: 12:00 PM – 10:00 PM",
              "Wednesday: 12:00 PM i�� 10:00 PM",
              "Thursday: 12:00 PM – 10:00 PM",
              "Friday: 12:00 PM – 12:00 AM",
              "Saturday: 12:00 PM – 12:00 AM",
              "Sunday: 12:00 PM – 8:00 PM",
            ],
            open_now: true,
            periods: [],
            hours_available: true,
          },
        },
        {
          id: 3,
          name: "Mad Hatters Ethnobotanical Tea Bar",
          address: "1561 N US Highway 1 #101, Ormond Beach, FL 32174",
          location: { lat: 29.31663, lng: -81.04608 },
          rating: 4.9,
          phone: "(386) 256-4192",
          website: "https://madhatterskava.com",
          verification_status: "verified_kava_bar",
          owner_id: null,
          is_sponsored: false,
          hours: {
            weekday_text: [
              "Monday: 10:00 AM – 10:00 PM",
              "Tuesday: 10:00 AM – 10:00 PM",
              "Wednesday: 10:00 AM – 10:00 PM",
              "Thursday: 10:00 AM – 10:00 PM",
              "Friday: 10:00 AM – 12:00 AM",
              "Saturday: 10:00 AM – 12:00 AM",
              "Sunday: 12:00 PM – 8:00 PM",
            ],
            open_now: true,
            periods: [],
            hours_available: true,
          },
        },
      ];

      try {
        // Use executeWithRetry to manage connections and handle retries with a short timeout for faster fallback
        const bars = await executeWithRetry(
          async () => {
            return await db.execute<{
              id: number;
              name: string;
              address: string;
              location: string;
              rating: number | null;
              review_count: number;
              verification_status: string;
              owner_id: number | null;
              is_sponsored: boolean;
              hours: string | null;
              grandOpeningDate: string | null;
              hours_json?: string;
              latest_gallery_photo?: string | null;
            }>(sql`
            SELECT 
              k.*, 
              k.hours::text as hours_json,
              (SELECT COUNT(*) FROM reviews WHERE bar_id = k.id) as review_count,
              CASE 
                WHEN (SELECT COUNT(*) FROM reviews WHERE bar_id = k.id) >= 3 
                THEN (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE bar_id = k.id)
                ELSE k.rating
              END as rating,
              (SELECT url FROM kava_bar_photos WHERE bar_id = k.id ORDER BY created_at DESC LIMIT 1) as latest_gallery_photo
            FROM kava_bars k
            LEFT JOIN users u ON k.owner_id = u.id
            WHERE k.verification_status != 'not_kava_bar'
            AND k.verification_status IS NOT NULL
            AND k.deleted_at IS NULL
            ${req.query.featured === 'true' ? sql`AND k.is_sponsored = true` : sql``}
            ORDER BY k.is_sponsored DESC, k.rating DESC NULLS LAST
            LIMIT 1000
          `);
          },
          {
            timeout: 3000, // Set a shorter timeout for faster fallback
            maxRetries: 1, // Only retry once
            priority: "high", // Set high priority for user-facing operation
          },
        );

        // Process and validate the bars
        const validBars = bars.rows.map((bar) => {
          try {
            // Parse location
            let parsedLocation = bar.location;
            if (typeof bar.location === "string") {
              parsedLocation = JSON.parse(bar.location);
            }

            // Parse hours - standardize format
            let parsedHours = null;
            if (bar.hours_json) {
              try {
                const hoursData = JSON.parse(bar.hours_json);
                // hours can be stored as a plain array ["Monday: 9 AM - 5 PM", ...]
                // OR as an object { weekday_text: [...], open_now: bool, ... }
                const weekdayText = Array.isArray(hoursData)
                  ? hoursData
                  : (hoursData.weekday_text || []);
                parsedHours = {
                  weekday_text: weekdayText,
                  open_now: hoursData.open_now || false,
                  periods: hoursData.periods || [],
                  hours_available: weekdayText.length > 0,
                };
              } catch (e) {
                console.log(`Error parsing hours for ${bar.name}:`, e);
                parsedHours = {
                  weekday_text: [],
                  open_now: false,
                  periods: [],
                  hours_available: false,
                };
              }
            } else {
              console.log(`No hours data found for ${bar.name}`);
              parsedHours = {
                weekday_text: [],
                open_now: false,
                periods: [],
                hours_available: false,
              };
            }

            return {
              ...bar,
              location: parsedLocation,
              hours: parsedHours,
              hours_json: undefined,
              rating: bar.rating ? Number(bar.rating) : null,
              reviewCount: Number((bar as any).review_count) || 0,
              heroImageUrl: (bar as any).hero_image_url || null,
              latestGalleryPhoto: (bar as any).latest_gallery_photo || null,
            };
          } catch (err) {
            console.error(`Error parsing data for bar ${bar.name}:`, err);
            return {
              ...bar,
              location: {
                lat: 28.0836,
                lng: -80.6081,
              },
              hours: {
                weekday_text: [],
                open_now: false,
                periods: [],
                hours_available: false,
              },
              rating: bar.rating ? Number(bar.rating) : null,
              reviewCount: Number((bar as any).review_count) || 0,
              heroImageUrl: (bar as any).hero_image_url || null,
              latestGalleryPhoto: (bar as any).latest_gallery_photo || null,
            };
          }
        });

        console.log(`Returning ${validBars.length} bars from database`);
        
        // Calculate distance and sort by proximity if lat/lng provided
        let barsWithDistance = validBars.map((bar: any) => {
          let loc = bar.location;
          let distance: number | null = null;
          if (!isNaN(lat) && !isNaN(lng) && loc?.lat && loc?.lng) {
            const R = 3958.8; // Earth's radius in miles
            const dLat = (loc.lat - lat) * Math.PI / 180;
            const dLng = (loc.lng - lng) * Math.PI / 180;
            const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180)*Math.cos(loc.lat*Math.PI/180)*Math.sin(dLng/2)**2;
            distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          }
          return { ...bar, distance };
        });
        
        // Filter by radius if provided
        if (!isNaN(lat) && !isNaN(lng) && radius > 0) {
          barsWithDistance = barsWithDistance.filter((b: any) => b.distance === null || b.distance <= radius);
        }
        
        // Sort: sponsored first, then by distance (or rating if no location)
        if (!isNaN(lat) && !isNaN(lng)) {
          barsWithDistance.sort((a: any, b: any) => {
            if (a.is_sponsored !== b.is_sponsored) return b.is_sponsored ? 1 : -1;
            const distA = a.distance ?? 9999;
            const distB = b.distance ?? 9999;
            return distA - distB;
          });
        }
        
        res.json(barsWithDistance);
      } catch (databaseError) {
        console.error("Database error, using fallback data:", databaseError);
        console.log(`Returning ${fallbackBars.length} fallback bars`);

        // Return fallback data with a custom header indicating degraded service
        res.setHeader("X-Service-Status", "degraded-fallback");
        res.json(fallbackBars);
      }
    } catch (error) {
      console.error("Critical error in kava bar endpoint:", error);

      // In case of a critical error, still try to return fallback data
      const emergencyFallbackBars = [
        {
          id: 1,
          name: "Bula on the Beach",
          address: "2525 S Atlantic Ave, Daytona Beach Shores, FL 32118",
          location: { lat: 29.155904, lng: -80.972269 },
          rating: 4.8,
          phone: "(386) 310-4815",
          verification_status: "verified_kava_bar",
          owner_id: null,
          is_sponsored: true,
          hours: {
            weekday_text: ["Monday-Sunday: 11AM-12AM"],
            open_now: true,
            periods: [],
            hours_available: true,
          },
        },
      ];

      res.setHeader("X-Service-Status", "emergency-fallback");

      res.json(emergencyFallbackBars);
    }
  });

  app.get("/api/favorite-kava-bars", async (req: Request, res: Response) => {
    try {
      console.log("Fetching favorite kava bars...");

      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        console.log("User not authenticated. Returning empty list.");
        return res.json([]);
      }

      const userId = Number(req.user.id); // Assuming user object has an 'id'
      console.log(`User id : ${userId}`);
      const favoriteBars = await executeWithRetry(
        async () => {
          return await db.execute<{
            id: number;
            name: string;
            address: string;
            location: string;
            rating: number | null;
            verification_status: string;
            owner_id: number | null;
            is_sponsored: boolean;
            hours: string | null;
            hours_json?: string;
            is_favourite: boolean;
          }>(sql`
            SELECT 
              k.*, 
              k.hours::text as hours_json,
              COALESCE(k.rating, 
                CASE 
                  WHEN k.place_id IS NOT NULL THEN CAST(k.rating AS DECIMAL)
                  WHEN k.verification_status = 'verified_kava_bar' THEN 4.0
                  ELSE 3.5 
                END
              ) as rating,
              TRUE AS is_favourite
            FROM kava_bars k
            INNER JOIN favourite_bars f ON k.id = f.bar_id
            WHERE f.user_id = ${userId} -- Filter by authenticated user's ID
            AND k.deleted_at IS NULL
            AND k.verification_status != 'not_kava_bar'
            AND k.verification_status IS NOT NULL
            ORDER BY k.is_sponsored DESC, k.rating DESC
          `);
        },
        {
          timeout: 3000,
          maxRetries: 1,
          priority: "high",
        },
      );

      console.log(
        `Found ${favoriteBars.rows.length} favorite kava bars for user ${userId}`,
      );

      const validFavoriteBars = favoriteBars.rows.map((bar) => {
        try {
          let parsedLocation = bar.location;
          if (typeof bar.location === "string") {
            parsedLocation = JSON.parse(bar.location);
          }

          let parsedHours = null;
          if (bar.hours_json) {
            try {
              const hoursData = JSON.parse(bar.hours_json);
              const weekdayText = Array.isArray(hoursData)
                ? hoursData
                : (hoursData.weekday_text || []);
              parsedHours = {
                weekday_text: weekdayText,
                open_now: hoursData.open_now || false,
                periods: hoursData.periods || [],
                hours_available: weekdayText.length > 0,
              };
            } catch (e) {
              console.log(`Error parsing hours for ${bar.name}:`, e);
              parsedHours = {
                weekday_text: [],
                open_now: false,
                periods: [],
                hours_available: false,
              };
            }
          } else {
            parsedHours = {
              weekday_text: [],
              open_now: false,
              periods: [],
              hours_available: false,
            };
          }

          return {
            ...bar,
            location: parsedLocation,
            hours: parsedHours,
            hours_json: undefined,
            rating: Number(bar.rating) || 0,
            isFavourite: true,
          };
        } catch (err) {
          console.error(`Error parsing data for bar ${bar.name}:`, err);
          return {
            ...bar,
            location: { lat: 28.0836, lng: -80.6081 },
            hours: {
              weekday_text: [],
              open_now: false,
              periods: [],
              hours_available: false,
            },
            rating: Number(bar.rating) || 0,
            isFavourite: true,
          };
        }
      });
      console.log(validFavoriteBars);
      res.json(validFavoriteBars);
    } catch (error) {
      console.error("Error fetching favorite kava bars:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Testing endpoint that always returns fallback data (for testing fallback system)
  app.get(
    "/api/kava-bars-test-fallback",
    async (req: Request, res: Response) => {
      console.log("Using fallback data for kava bars (test endpoint)");

      // Define a fallback dataset with actual locations
      const fallbackBars = [
        {
          id: 1,
          name: "Bula on the Beach",
          address: "2525 S Atlantic Ave, Daytona Beach Shores, FL 32118",
          location: { lat: 29.155904, lng: -80.972269 },
          rating: 4.8,
          phone: "(386) 310-4815",
          website: "https://www.bulaonthebeach.com",
          verification_status: "verified_kava_bar",
          owner_id: null,
          is_sponsored: true,
          hours: {
            weekday_text: [
              "Monday: 11:00 AM – 12:00 AM",
              "Tuesday: 11:00 AM – 12:00 AM",
              "Wednesday: 11:00 AM – 12:00 AM",
              "Thursday: 11:00 AM – 12:00 AM",
              "Friday: 11:00 AM – 2:00 AM",
              "Saturday: 11:00 AM – 2:00 AM",
              "Sunday: 11:00 AM – 12:00 AM",
            ],
            open_now: true,
            periods: [],
            hours_available: true,
          },
        },
        {
          id: 2,
          name: "MITRA Kava Bar",
          address: "140 Magnolia Ave, Daytona Beach, FL 32114",
          location: { lat: 29.21098, lng: -81.02214 },
          rating: 4.7,
          phone: "(386) 238-9941",
          website: "https://mitrakavabar.com",
          verification_status: "verified_kava_bar",
          owner_id: null,
          is_sponsored: true,
          hours: {
            weekday_text: [
              "Monday: 12:00 PM – 10:00 PM",
              "Tuesday: 12:00 PM – 10:00 PM",
              "Wednesday: 12:00 PM – 10:00 PM",
              "Thursday: 12:00 PM – 10:00 PM",
              "Friday: 12:00 PM – 12:00 AM",
              "Saturday: 12:00 PM – 12:00 AM",
              "Sunday: 12:00 PM – 8:00 PM",
            ],
            open_now: true,
            periods: [],
            hours_available: true,
          },
        },
        {
          id: 3,
          name: "Mad Hatters Ethnobotanical Tea Bar",
          address: "1561 N US Highway 1 #101, Ormond Beach, FL 32174",
          location: { lat: 29.31663, lng: -81.04608 },
          rating: 4.9,
          phone: "(386) 256-4192",
          website: "https://madhatterskava.com",
          verification_status: "verified_kava_bar",
          owner_id: null,
          is_sponsored: false,
          hours: {
            weekday_text: [
              "Monday: 10:00 AM – 10:00 PM",
              "Tuesday: 10:00 AM – 10:00 PM",
              "Wednesday: 10:00 AM – 10:00 PM",
              "Thursday: 10:00 AM – 10:00 PM",
              "Friday: 10:00 AM – 12:00 AM",
              "Saturday: 10:00 AM – 12:00 AM",
              "Sunday: 12:00 PM – 8:00 PM",
            ],
            open_now: true,
            periods: [],
            hours_available: true,
          },
        },
      ];

      // Return fallback data with a custom header indicating this is test data
      res.setHeader("X-Service-Status", "test-fallback");
      res.json(fallbackBars);
    },
  );

  app.get("/api/kava-bars/verification-status", async (req, res) => {
    try {
      console.log("Fetching verification status with connection management...");

      // Use executeWithRetry to manage connections and handle retries
      const bars = await executeWithRetry(async () => {
        return await db.query.kavaBars.findMany({
          orderBy: (kavaBars, { desc }) => [
            desc(kavaBars.dataCompletenessScore),
          ],
          columns: {
            id: true,
            name: true,
            address: true,
            verificationStatus: true,
            lastVerified: true,
            dataCompletenessScore: true,
            isVerifiedKavaBar: true,
            verificationNotes: true,
            businessStatus: true,
          },
        });
      });

      // Calculate verification statistics
      const stats = {
        total: bars.length,
        verified: bars.filter((b) => b.isVerifiedKavaBar).length,
        pending: bars.filter((b) => !b.verificationStatus).length,
        notKavaBars: bars.filter((b) => b.verificationStatus === "not_kava_bar")
          .length,
        averageCompleteness:
          bars.reduce(
            (acc, bar) => acc + Number(bar.dataCompletenessScore || 0),
            0,
          ) / bars.length || 0,
      };

      res.json({
        statistics: stats,
        bars: bars,
      });
    } catch (error: any) {
      console.error("Error fetching verification status:", error);
      res.status(500).json({
        error: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });

  // ── Admin bar management endpoints ──────────────────────────────────────
  // POST /api/kava-bars/:id/set-featured — toggle featured status
  app.post("/api/kava-bars/:id/set-featured", isAuthenticated, async (req, res) => {
    try {
      if (!req.user?.isAdmin) return res.status(403).json({ error: "Admin only" });
      const id = Number(req.params.id);
      const { is_featured } = req.body;
      await db.execute(sql`UPDATE kava_bars SET is_sponsored = ${is_featured ? true : false} WHERE id = ${id}`);
      res.json({ success: true, id, is_featured });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH /api/bars/:id — update bar fields (active status, etc.)
  app.patch(["/api/bars/:id", "/api/kava-bars/:id/active"], isAuthenticated, async (req, res) => {
    try {
      if (!req.user?.isAdmin) return res.status(403).json({ error: "Admin only" });
      const id = Number(req.params.id);
      const { is_active } = req.body;
      if (is_active !== undefined) {
        const status = is_active ? "OPERATIONAL" : "CLOSED_TEMPORARILY";
        await db.execute(sql`UPDATE kava_bars SET business_status = ${status} WHERE id = ${id}`);
      }
      res.json({ success: true, id, ...req.body });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  // ── End admin bar management ──────────────────────────────────────────────

  // ── Missing mobile endpoints ──────────────────────────────────────────────
  // GET /api/events — all upcoming events (used by Events tab)
  app.get("/api/events", async (req, res) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      
      // Fetch non-recurring events
      const nonRecurringEvents = await db.query.barEvents.findMany({
        where: and(
          eq(barEvents.isRecurring, false),
          gte(barEvents.endDate, today)
        ),
        orderBy: [desc(barEvents.startDate)],
        limit: 100,
        with: {
          bar: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });
      
      // Fetch all recurring events
      const recurringEvents = await db.query.barEvents.findMany({
        where: eq(barEvents.isRecurring, true),
        orderBy: [barEvents.dayOfWeek],
        with: {
          bar: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });
      
      // Combine and add bar name to each event
      const allEvents = [...nonRecurringEvents, ...recurringEvents].map(event => ({
        ...event,
        barName: event.bar?.name || 'Unknown Bar',
      }));
      
      res.json({ events: allEvents });
    } catch (e: any) {
      console.error("Error fetching events:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/event-rsvp/:id — get RSVP details for an event
  app.get("/api/event-rsvp/:id", async (req, res) => {
    try {
      const eventId = Number(req.params.id);
      const rsvps = await db.query.eventRsvps.findMany({
        where: eq(eventRsvps.eventId, eventId),
      });
      res.json(rsvps);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/bars/verification-status — alias for mobile
  app.get("/api/bars/verification-status", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT verification_status, COUNT(*) as count
        FROM kava_bars
        GROUP BY verification_status
      `);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  // ── End missing mobile endpoints ──────────────────────────────────────────

  // Update the bar details endpoint to properly format hours and provide fallbacks
  // /api/bars/:id(\d+) is the mobile alias — numeric only so it doesn't conflict with /api/bars/:city/:slug
  app.get(["/api/kava-bars/:id", "/api/bars/:id(\\d+)"], async (req, res) => {
    const { id } = req.params;
    try {
      console.log("Bar details request:", {
        barId: req.params.id,
        authenticated: req.isAuthenticated(),
        user: req.user
          ? {
              id: req.user.id,
              role: req.user.role,
              isAdmin: req.user.isAdmin,
            }
          : null,
      });

      // Define fallback bar data based on ID
      interface FallbackBar {
        id: number;
        name: string;
        address: string;
        location: { lat: number; lng: number };
        rating: number;
        phone: string | null;
        website: string | null;
        verification_status: string;
        business_status: string;
        owner_id: number | null;
        is_sponsored: boolean;
        placeId: string | null;
        hours: any;
        [key: string]: any; // Allow any additional properties
      }

      const fallbackBarData: Record<number, FallbackBar> = {
        1: {
          id: 1,
          name: "Bula on the Beach",
          address: "2525 S Atlantic Ave, Daytona Beach Shores, FL 32118",
          location: { lat: 29.155904, lng: -80.972269 },
          rating: 4.8,
          phone: "(386) 310-4815",
          website: "https://www.bulaonthebeach.com",
          verification_status: "verified_kava_bar",
          business_status: "OPERATIONAL",
          owner_id: null,
          is_sponsored: true,
          placeId: "ChIJaW9yLPvcuogRtgkO1dBESI8",
          hours: {
            weekday_text: [
              "Monday: 11:00 AM – 12:00 AM",
              "Tuesday: 11:00 AM – 12:00 AM",
              "Wednesday: 11:00 AM – 12:00 AM",
              "Thursday: 11:00 AM – 12:00 AM",
              "Friday: 11:00 AM – 2:00 AM",
              "Saturday: 11:00 AM – 2:00 AM",
              "Sunday: 11:00 AM – 12:00 AM",
            ],
            open_now: true,
            periods: [],
            hours_available: true,
          },
        },
        2: {
          id: 2,
          name: "MITRA Kava Bar",
          address: "140 Magnolia Ave, Daytona Beach, FL 32114",
          location: { lat: 29.21098, lng: -81.02214 },
          rating: 4.7,
          phone: "(386) 238-9941",
          website: "https://mitrakavabar.com",
          verification_status: "verified_kava_bar",
          business_status: "OPERATIONAL",
          owner_id: null,
          is_sponsored: true,
          placeId: "ChIJn3-LkSzf5YgRrzWQWsV3L5g",
          hours: {
            weekday_text: [
              "Monday: 12:00 PM – 10:00 PM",
              "Tuesday: 12:00 PM – 10:00 PM",
              "Wednesday: 12:00 PM – 10:00 PM",
              "Thursday: 12:00 PM – 10:00 PM",
              "Friday: 12:00 PM – 12:00 AM",
              "Saturday: 12:00 PM – 12:00 AM",
              "Sunday: 12:00 PM – 8:00 PM",
            ],
            open_now: true,
            periods: [],
            hours_available: true,
          },
        },
        3: {
          id: 3,
          name: "Mad Hatters Ethnobotanical Tea Bar",
          address: "1561 N US Highway 1 #101, Ormond Beach, FL 32174",
          location: { lat: 29.31663, lng: -81.04608 },
          rating: 4.9,
          phone: "(386) 256-4192",
          website: "https://madhatterskava.com",
          verification_status: "verified_kava_bar",
          business_status: "OPERATIONAL",
          owner_id: null,
          is_sponsored: false,
          placeId: "ChIJg-WMPUjf5YgR8zwH7jdh3fo",
          hours: {
            weekday_text: [
              "Monday: 10:00 AM – 10:00 PM",
              "Tuesday: 10:00 AM – 10:00 PM",
              "Wednesday: 10:00 AM – 10:00 PM",
              "Thursday: 10:00 AM – 10:00 PM",
              "Friday: 10:00 AM – 12:00 AM",
              "Saturday: 10:00 AM – 12:00 AM",
              "Sunday: 12:00 PM – 8:00 PM",
            ],
            open_now: true,
            periods: [],
            hours_available: true,
          },
        },
      };

      try {
        // Use executeWithRetry to manage connections and handle retries with a short timeout
        const result = await executeWithRetry(
          async () => {
            return await db.execute(sql`
          SELECT 
            k.*,
            k.hours::text as hours_json,
            (SELECT COUNT(*) FROM reviews WHERE bar_id = k.id) as review_count,
            CASE 
              WHEN (SELECT COUNT(*) FROM reviews WHERE bar_id = k.id) >= 3 
              THEN (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE bar_id = k.id)
              ELSE k.rating
            END as rating
          FROM kava_bars k
          WHERE k.id = ${Number(req.params.id)}
          LIMIT 1;
          `);
          },
          {
            timeout: 3000, // Set a shorter timeout for faster fallback
            maxRetries: 1, // Only retry once
            priority: "high", // Set high priority for user-facing operation
          },
        );

        if (!result.rows.length) {
          console.log(`Bar not found with ID: ${req.params.id}`);

          // Check if we have a fallback for this ID
          const requestedId = Number(req.params.id);
          if (fallbackBarData[requestedId]) {
            console.log(`Using fallback data for bar ID: ${requestedId}`);
            res.setHeader("X-Service-Status", "fallback-data");
            return res.json(fallbackBarData[requestedId]);
          }

          return res.status(404).json({ error: "Bar not found" });
        }

        const bar = result.rows[0];
        console.log("Bar results: ", bar);
        // Prepare basic bar data that's publicly accessible
        const publicBarData = {
          id: bar.id,
          name: bar.name,
          address: bar.address,
          hours: bar.hours,
          comingSoon: bar.coming_soon ?? false,
          grandOpeningDate: bar.grand_opening_date || undefined,
          phone: bar.phone,
          businessStatus: bar.business_status,
          rating: bar.rating ? Number(bar.rating) : null,
          reviewCount: Number(bar.review_count) || 0,
          isSponsored: bar.is_sponsored,
          verificationStatus: bar.verification_status,
          placeId: bar.place_id,
          website: bar.website,
          location: bar.location,
          heroImageUrl: bar.hero_image_url || null,
        };

        // Parse hours data with enhanced error handling and logging
        let parsedHours = null;
        // if (bar.hours_json) {
        //   try {
        //     console.log("Raw hours data:", bar.hours_json);
        //     const hoursData = JSON.parse(bar.hours_json);
        //     parsedHours = {
        //       weekday_text: hoursData.weekday_text || [],
        //       open_now: hoursData.open_now || false,
        //       periods: hoursData.periods || [],
        //       hours_available: true,
        //     };
        //     console.log("Parsed hours:", parsedHours);
        //   } catch (error) {
        //     console.error("Error parsing hours:", error);
        //     parsedHours = {
        //       weekday_text: [],
        //       open_now: false,
        //       periods: [],
        //       hours_available: false,
        //     };
        //   }
        // }

        // Parse location with error handling
        let parsedLocation = bar.location;
        try {
          if (typeof bar.location === "string") {
            parsedLocation = JSON.parse(bar.location);
          }
        } catch (error) {
          console.error("Error parsing location:", error);
          parsedLocation = null;
        }
        let isBarStaff = false;
        if (req.user && req.user.id) {
          const result = await db
            .select()
            .from(barStaff)
            .where(
              and(
                eq(barStaff.userId, req.user.id),
                eq(barStaff.barId, Number(id)),
              ),
            );

          if (result.length > 0) {
            isBarStaff = true;
          }
        }
        // Fetch photos for this bar (needed by mobile app which reads bar.photos)
        const barPhotos = await db.query.kavaBarPhotos.findMany({
          where: eq(kavaBarPhotos.barId, Number(id)),
          orderBy: desc(kavaBarPhotos.createdAt),
        });

        const latestGalleryPhoto = barPhotos.length > 0 ? barPhotos[0].url : null;

        const fullBarData = {
          ...publicBarData,
          ownerId: bar.owner_id,
          hours: bar.hours,
          location: parsedLocation,
          createdAt: bar.created_at,
          updatedAt: bar.updated_at,
          lastVerified: bar.last_verified,
          dataCompletenessScore: bar.data_completeness_score,
          googlePlaceId: bar.google_place_id,
          isVerifiedKavaBar: bar.is_verified_kava_bar,
          isBarStaff,
          comingSoon: bar.coming_soon ?? false,
          grandOpeningDate: bar.grand_opening_date || undefined,
          verificationNotes: req.user?.isAdmin
            ? bar.verification_notes
            : undefined,
          vibeText: bar.vibe_text || `Welcome to ${bar.name}! We are a new addition to the kava community. Stop by and check out our atmosphere.`,
          menuHighlights: bar.menu_highlights || null,
          features: bar.features || null,
          photos: barPhotos,
          latestGalleryPhoto,
        };
        console.log("Full bar data: ", fullBarData);
        console.log("Sending bar details response:", {
          id: fullBarData.id,
          name: fullBarData.name,
          hasHours: !!fullBarData.hours,
          hoursData: fullBarData.hours,
          isAuthenticated: req.isAuthenticated(),
          userRole: req.user?.role,
        });

        res.json(fullBarData);
      } catch (databaseError) {
        console.error(
          "Database error fetching bar details, using fallback data:",
          databaseError,
        );

        // Try to use fallback data
        const requestedId = Number(req.params.id);
        if (fallbackBarData[requestedId]) {
          console.log(`Using fallback data for bar ID: ${requestedId}`);
          res.setHeader("X-Service-Status", "database-error-fallback");
          return res.json(fallbackBarData[requestedId]);
        }

        // If no fallback exists, return a proper error
        res.status(500).json({
          error: "Failed to fetch bar details",
          details:
            process.env.NODE_ENV === "development"
              ? databaseError.message
              : undefined,
        });
      }
    } catch (error: any) {
      console.error("Critical error in bar details endpoint:", error);

      // Try one more time with a generic fallback
      const genericFallback = {
        id: Number(req.params.id),
        name: "Kava Bar",
        address: "Address not available",
        location: { lat: 28.7917, lng: -81.2778 }, // Orlando, FL as a fallback
        rating: 4.0,
        phone: null,
        businessStatus: "OPERATIONAL",
        verificationStatus: "pending",
        placeId: null,
        website: null,
        isSponsored: false,
        ownerId: null,
        hours: {
          weekday_text: ["Hours not available"],
          open_now: false,
          periods: [],
          hours_available: false,
        },
      };

      res.setHeader("X-Service-Status", "emergency-fallback");
      res.json(genericFallback);
    }
  });

  // Add password reset endpoints
  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    try {
      // Find user by email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (!user) {
        // Don't reveal if user exists or not
        return res.json({
          message:
            "If an account exists for this email, you will receive a password reset link.",
        });
      }

      // Create a password reset token
      const [resetToken] = await db
        .insert(passwordResetTokens)
        .values({
          userId: user.id,
          expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        })
        .returning();

      // Generate reset link
      const resetLink = `${req.protocol}://${req.get("host")}/reset-password/${resetToken.token}`;

      try {
        await sendPasswordResetEmail(email, resetLink);
        res.json({ message: "If an account exists for this email, you will receive a password reset link." });
      } catch (emailError: any) {
        console.error("Password reset email error:", emailError);
        await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, resetToken.id));
        res.status(500).json({ message: "Failed to process password reset request" });
      }
    } catch (error: any) {
      console.error("Password reset error:", error);
      res
        .status(500)
        .json({ message: "Failed to process password reset request" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: "Token and new password are required" });
    }

    try {
      // Find valid reset token
      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, token),
            isNull(passwordResetTokens.usedAt),
            sql`${passwordResetTokens.expiresAt} > NOW()`,
          ),
        )
        .limit(1);

      if (!resetToken) {
        return res
          .status(400)
          .json({ message: "Invalid or expired reset token" });
      }

      // Hash new password using the crypto utility
      const hashedPassword = await crypto.hash(newPassword);

      // Update user's password and mark token as used
      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ password: hashedPassword })
          .where(eq(users.id, resetToken.userId));

        await tx
          .update(passwordResetTokens)
          .set({ usedAt: new Date() })
          .where(eq(passwordResetTokens.id, resetToken.id));
      });

      res.json({ message: "Password has been reset successfully" });
    } catch (error: any) {
      console.error("Password reset error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Development only - seed route
  if (process.env.NODE_ENV !== "production") {
    app.post("/api/seed", async (req, res) => {
      try {
        // Create test user if not exists
        const [testUser] = await db
          .select()
          .from(users)
          .where(eq(users.username, "testuser"))
          .limit(1);

        let userId;
        if (!testUser) {
          const hashedPassword = await cryptoLib.hash("testpassword123");
          const [newUser] = await db
            .insert(users)
            .values({
              username: "testuser",
              password: hashedPassword,
              isAdmin: true,
              email: "test@example.com",
            })
            .returning();
          userId = newUser.id;
        } else {
          userId = testUser.id;
        }

        // Clear existing data
        await db.execute(sql`TRUNCATE TABLE kava_bars CASCADE`);

        res.json({
          message: "Sample data seeded successfully",
          testUser: {
            username: "testuser",
            password: "testpassword123",
          },
        });
      } catch (error: any) {
        console.error("Seed error:", error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  // Add fetch data endpoint (admin only)
  app.post("/api/admin/fetch-kava-bars", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      await fetchKavaBars();
      res.json({ message: "Successfully fetched kava bar data" });
    } catch (error: any) {
      console.error("Error fetching kava bar data:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add owner dashboard endpoint with enhanced debug logging
  app.get("/api/owner/bars", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Verify user has proper role
      if (!req.user.isAdmin && req.user.role !== "bar_owner") {
        return res.status(403).json({
          error: "Not authorized",
          details: "You must be a bar owner or administrator to access this feature",
        });
      }

      // Pagination & search params
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 50));
      const searchQuery = (req.query.search as string || "").trim().toLowerCase();
      const offset = (page - 1) * limit;

      // Build search condition if provided
      const searchCondition = searchQuery
        ? or(
            sql`LOWER(${kavaBars.name}) LIKE ${'%' + searchQuery + '%'}`,
            sql`LOWER(${kavaBars.address}) LIKE ${'%' + searchQuery + '%'}`
          )
        : undefined;

      // Build owned bars query condition
      const ownedCondition = req.user.isAdmin
        ? searchCondition // Admins see all bars
        : searchCondition
          ? and(eq(kavaBars.ownerId, req.user.id), searchCondition)
          : eq(kavaBars.ownerId, req.user.id);

      // Get total count for pagination
      const [{ count: totalOwned }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(kavaBars)
        .where(req.user.isAdmin ? searchCondition : (searchCondition ? and(eq(kavaBars.ownerId, req.user.id), searchCondition) : eq(kavaBars.ownerId, req.user.id)));

      // Get bars with pagination (no expensive owner join for large result sets)
      const ownedBars = await db.query.kavaBars.findMany({
        where: ownedCondition,
        orderBy: (kavaBars, { asc }) => [asc(kavaBars.name)],
        limit,
        offset,
      });

      // Build unclaimed bars condition
      const unclaimedCondition = searchCondition
        ? and(isNull(kavaBars.ownerId), ne(kavaBars.verificationStatus, "not_kava_bar"), searchCondition)
        : and(isNull(kavaBars.ownerId), ne(kavaBars.verificationStatus, "not_kava_bar"));

      // Get unclaimed count
      const [{ count: totalUnclaimed }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(kavaBars)
        .where(unclaimedCondition);

      // Get unclaimed bars with pagination
      const unclaimedBars = await db.query.kavaBars.findMany({
        where: unclaimedCondition,
        orderBy: (kavaBars, { asc }) => [asc(kavaBars.name)],
        limit,
        offset,
      });

      res.json({
        ownedBars,
        unclaimedBars,
        pagination: {
          page,
          limit,
          totalOwned: Number(totalOwned),
          totalUnclaimed: Number(totalUnclaimed),
          totalPages: Math.ceil(Math.max(Number(totalOwned), Number(totalUnclaimed)) / limit),
        },
      });
    } catch (error: any) {
      console.error("Error fetching owner bars:", error);
      res.status(500).json({
        error: "Failed to fetch bars",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  // // Photo endpoints with debug logging
  // app.get("/api/bars/:id/photos", async (req, res) => {
  //   try {
  //     const barId = Number(req.params.id);
  //     console.log(`Fetching photos for bar ${barId}`, {
  //       authenticated: req.isAuthenticated(),
  //       user: req.user ? { id: req.user.id, role: req.user.role } : null,
  //     });

  //     const photos = await db.query.kavaBarPhotos.findMany({
  //       where: eq(kavaBarPhotos.barId, barId),
  //       orderBy: [desc(kavaBarPhotos.createdAt)],
  //     });

  //     console.log(`Found ${photos.length} photos for bar ${barId}`);
  //     res.json(photos);
  //   } catch (error: any) {
  //     console.error("Error fetching photos:", error);
  //     res.status(500).json({ error: "Failed to fetch photos" });
  //   }
  // });

  // Photo deletion endpoint - requires authentication
  app.delete(
    "/api/bars/:id/photos/:photoId",
    isAuthenticated,
    async (req, res) => {
      // ... existing delete implementation ...
    },
  );
  app.get("/api/kavatender/referrals", isAuthenticated, async (req, res) => {
    try {
      if (!req.user)
        return res.status(401).json({ error: "Not authenticated" });
      const role = req.user.role;
      if (role !== "kavatender")
        return res.status(403).json({ error: "Not authorized" });
      const userId = req.user.id;
      if (isNaN(userId))
        return res.status(400).json({ error: "Invalid user ID" });

      const result = await getUserReferralDetails(userId);
      return res.json(result);
    } catch (error: any) {
      console.error("Failed to get referral data", error);
      return res.status(500).json({
        error: "Something went wrong",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  app.post("/api/kava-bars/:id/claim", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const barId = Number(req.params.id);

    // Verify bar exists and isn't already claimed
    const [bar] = await db
      .select()
      .from(kavaBars)
      .where(eq(kavaBars.id, barId))
      .limit(1);

    if (!bar) {
      return res.status(404).send("Bar not found");
    }

    if (bar.ownerId) {
      return res.status(400).send("This bar has already been claimed");
    }

    // Require verification code from request
    const { verificationCode } = req.body;
    if (!verificationCode) {
      return res.status(400).send("Verification code is required");
    }

    // Find a valid verification code
    const [code] = await db
      .select()
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.barId, barId),
          eq(verificationCodes.code, verificationCode),
          eq(verificationCodes.isUsed, false),
        ),
      )
      .limit(1);

    if (!code) {
      return res.status(400).send("Invalid verification code");
    }

    const now = new Date();
    if (now > code.expiresAt) {
      return res.status(400).send("Verification code has expired");
    }

    try {
      // Start a transaction to ensure atomicity
      await db.transaction(async (tx) => {
        // Mark the code as used
        await tx
          .update(verificationCodes)
          .set({ isUsed: true })
          .where(eq(verificationCodes.id, code.id));

        // Update user role to bar owner
        await tx
          .update(users)
          .set({
            role: "bar_owner",
            updatedAt: now,
          })
          .where(eq(users.id, req.user.id));

        // Log the role change
        await tx.insert(userActivityLogs).values({
          userId: req.user.id,
          activityType: "role_change",
          details: {
            from: req.user.role,
            to: "bar_owner",
            reason: "Bar claim verification",
          },
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });

        // Update bar ownership
        const [updatedBar] = await tx
          .update(kavaBars)
          .set({ ownerId: req.user.id })
          .where(eq(kavaBars.id, barId))
          .returning();

        res.json(updatedBar);
      });
    } catch (error: any) {
      console.error("Error claiming bar:", error);
      res.status(500).send("Failed to claim bar");
    }
  });

  // Add hours update endpoint after the existing bar routes
  app.put("/api/kava-bars/:id/hours", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const barId = Number(req.params.id);

    // Verify bar exists and user owns it
    const [bar] = await db
      .select()
      .from(kavaBars)
      .where(eq(kavaBars.id, barId))
      .limit(1);

    if (!bar) {
      return res.status(404).send("Bar not found");
    }

    if (bar.ownerId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).send("Not authorized to update this bar's hours");
    }
    console.log("Hours ", req.body.hours);
    console.log("Parsed Hours: ", parseHours(req.body.hours));
    try {
      const [updatedBar] = await db
        .update(kavaBars)
        .set({
          hours: parseHours(req.body.hours), // Using the correct field name from schema
        })
        .where(eq(kavaBars.id, barId))
        .returning();

      res.json(updatedBar);
    } catch (error: any) {
      console.error("Error updating hours:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update hero image endpoint for bar owners (URL method)
  app.put("/api/kava-bars/:id/hero-image", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const barId = Number(req.params.id);

    // Verify bar exists and user owns it
    const [bar] = await db
      .select()
      .from(kavaBars)
      .where(eq(kavaBars.id, barId))
      .limit(1);

    if (!bar) {
      return res.status(404).send("Bar not found");
    }

    if (bar.ownerId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).send("Not authorized to update this bar's hero image");
    }

    try {
      const { heroImageUrl } = req.body;
      
      const [updatedBar] = await db
        .update(kavaBars)
        .set({
          heroImageUrl: heroImageUrl || null,
        })
        .where(eq(kavaBars.id, barId))
        .returning();

      res.json(updatedBar);
    } catch (error: any) {
      console.error("Error updating hero image:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload hero image endpoint for bar owners (file upload to R2)
  app.post(
    "/api/kava-bars/:id/hero-image",
    upload.single("heroImage"),
    async (req, res) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const barId = Number(req.params.id);

      // Verify bar exists and user owns it
      const [bar] = await db
        .select()
        .from(kavaBars)
        .where(eq(kavaBars.id, barId))
        .limit(1);

      if (!bar) {
        return res.status(404).json({ error: "Bar not found" });
      }

      if (bar.ownerId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ error: "Not authorized to update this bar's hero image" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
      }

      try {
        // Process the image with Sharp - resize to optimal hero image dimensions
        const processedImageBuffer = await sharp(req.file.buffer)
          .resize(1200, 675, {
            fit: "cover",
            position: "center",
          })
          .jpeg({ quality: 85 })
          .toBuffer();

        // Generate unique filename
        const fileName = `hero-images/bar-${barId}-${Date.now()}.jpg`;

        // Upload to R2 storage
        const { publicUrl } = await uploadImageToStorage(processedImageBuffer, fileName);

        // Update the bar's hero image URL in the database
        const [updatedBar] = await db
          .update(kavaBars)
          .set({
            heroImageUrl: publicUrl,
          })
          .where(eq(kavaBars.id, barId))
          .returning();

        res.json({ 
          success: true, 
          heroImageUrl: publicUrl,
          bar: updatedBar 
        });
      } catch (error: any) {
        console.error("Error uploading hero image:", error);
        res.status(500).json({ error: error.message || "Failed to upload hero image" });
      }
    }
  );

  // Regenerate AI Vibe Check (Admin only)
  app.post("/api/kava-bars/:id/regenerate-vibe", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const barId = Number(req.params.id);

    try {
      const result = await enrichBarData(barId);
      res.json({
        success: true,
        vibeText: result.vibeText,
        menuHighlights: result.menuHighlights,
        features: result.features,
      });
    } catch (error: any) {
      console.error("Error regenerating vibe:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update bar vibe and menu info (Owner Dashboard)
  app.put("/api/kava-bars/:id/details", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const barId = Number(req.params.id);

    // Verify bar exists and user owns it
    const [bar] = await db
      .select()
      .from(kavaBars)
      .where(eq(kavaBars.id, barId))
      .limit(1);

    if (!bar) {
      return res.status(404).json({ error: "Bar not found" });
    }

    if (bar.ownerId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: "Not authorized to update this bar" });
    }

    try {
      const { vibeText, menuHighlights, features } = req.body;
      
      const updateData: Record<string, any> = {};
      if (vibeText !== undefined) updateData.vibeText = vibeText;
      if (menuHighlights !== undefined) updateData.menuHighlights = menuHighlights;
      if (features !== undefined) updateData.features = features;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      const [updatedBar] = await db
        .update(kavaBars)
        .set(updateData)
        .where(eq(kavaBars.id, barId))
        .returning();

      res.json({
        success: true,
        bar: {
          id: updatedBar.id,
          vibeText: updatedBar.vibeText,
          menuHighlights: updatedBar.menuHighlights,
          features: updatedBar.features,
        }
      });
    } catch (error: any) {
      console.error("Error updating bar details:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin endpoints for verification codes
  app.post("/api/admin/verification-codes/:barId", async (req, res) => {
    try {
      console.log("Verification code generation request:", {
        authenticated: req.isAuthenticated(),
        user: req.user
          ? {
              id: req.user.id,
              isAdmin: req.user.isAdmin,
              role: req.user.role,
            }
          : null,
        session: req.session ? { id: req.session.id } : null,
        cookies: req.headers.cookie,
      });

      // Check authentication first
      if (!req.isAuthenticated()) {
        console.log("Authentication failed - user not authenticated");
        return res.status(401).json({ error: "Not authenticated" });
      }

      if (!req.user.isAdmin) {
        console.log("Authorization failed - user not admin:", req.user);
        return res.status(403).json({ error: "Admin access required" });
      }

      const barId = Number(req.params.barId);
      if (isNaN(barId)) {
        return res.status(400).json({ error: "Invalid bar ID" });
      }

      console.log("Generating verification code for bar:", barId);

      // Check if bar exists
      const [bar] = await db
        .select()
        .from(kavaBars)
        .where(eq(kavaBars.id, barId))
        .limit(1);

      if (!bar) {
        console.log("Bar not found:", barId);
        return res.status(404).json({ error: "Bar not found" });
      }

      // Generate a verification code
      const code = `VERIFY-${barId}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      console.log("Saving verification code:", {
        barId,
        code,
        expiresAt,
      });

      // Save the verification code
      const [verificationCode] = await db
        .insert(verificationCodes)
        .values({
          barId,
          code,
          expiresAt,
        })
        .returning();

      console.log(
        "Verification code generated successfully:",
        verificationCode,
      );

      // Return JSON response
      return res.json(verificationCode);
    } catch (error: any) {
      console.error("Error generating verification code:", error);
      return res.status(500).json({
        error: "Failed to generate verification code",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  // Get all verification codes (admin only)
  app.get("/api/admin/verification-codes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      const codes = await db.query.verificationCodes.findMany({
        with: {
          bar: true,
        },
        orderBy: (verificationCodes, { desc }) => [
          desc(verificationCodes.createdAt),
        ],
      });

      res.json(codes);
    } catch (error: any) {
      console.error("Error fetching verification codes:", error);
      res.status(500).send(error.message);
    }
  });

  // Add new verification requests route handlers
  app.post("/api/verification-requests", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { barId, requesterName, barName, phoneNumber } = req.body;

    try {
      console.log("Creating new verification request:", {
        barId,
        requesterName,
        barName,
        phoneNumber,
        userId: req.user.id,
      });

      const [request] = await db
        .insert(verificationRequests)
        .values({
          barId,
          requesterName,
          barName,
          phoneNumber,
          requesterId: req.user.id,
          status: "pending",
        })
        .returning();

      // Get all admin users
      const admins = await db
        .select()
        .from(users)
        .where(eq(users.isAdmin, true));

      console.log(`Found ${admins.length} admin users to notify`);

      // Notify connected admin users via WebSocket
      const notificationPayload = {
        type: "VERIFICATION_REQUEST",
        data: {
          id: request.id,
          barId: request.barId,
          barName,
          requesterName,
          phoneNumber,
          timestamp: request.createdAt.toISOString(),
          requesterId: req.user.id,
        },
      };

      console.log("Sending WebSocket notification:", notificationPayload);
      notifyAdmins(wss, notificationPayload);
      // Send email about the bar added
      await sendNotificationEmail("info@mykavabar.com", "New Bar Verification Request", "A new bar has been submitted for verification. Check the admin dashboard.").catch(console.error);
      res.json(request);
    } catch (error: any) {
      console.error("Error creating verification request:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all pending verification requests (admin only)
  app.get("/api/admin/verification-requests", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      const requests = await db.query.verificationRequests.findMany({
        where: eq(verificationRequests.status, "pending"),
        with: {
          bar: true,
          requester: true,
        },
        orderBy: (verificationRequests, { desc }) => [
          desc(verificationRequests.createdAt),
        ],
      });

      res.json(requests);
    } catch (error: any) {
      console.error("Error fetching verification requests:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin CRUD endpoints for kava bars management

  // Create a new kava bar
  app.post("/api/admin/bars", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const barData = req.body;
      const locationValue = barData.location
        ? JSON.stringify(barData.location)
        : null;
      const ratingValue = barData.rating ? parseFloat(barData.rating) : null;

      // Insert the new bar
      const result = await db
        .insert(kavaBars)
        .values({
          name: barData.name,
          address: barData.address,
          phone: barData.phone || null,
          placeId: barData.placeId || null,
          rating: ratingValue,
          location: locationValue,
          verificationStatus: "pending",
          businessStatus: "OPERATIONAL",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error("Error adding bar:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update an existing kava bar
  app.put("/api/admin/bars/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.params;
    const barId = parseInt(id);

    if (isNaN(barId)) {
      return res.status(400).json({ error: "Invalid bar ID" });
    }

    try {
      const barData = req.body;
      const locationValue = barData.location
        ? JSON.stringify(barData.location)
        : null;
      const ratingValue = barData.rating ? parseFloat(barData.rating) : null;

      // Update the bar
      const result = await db
        .update(kavaBars)
        .set({
          name: barData.name,
          address: barData.address,
          phone: barData.phone || null,
          placeId: barData.placeId || null,
          rating: ratingValue,
          location: locationValue,
          updatedAt: new Date(),
        })
        .where(eq(kavaBars.id, barId))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: "Bar not found" });
      }

      res.json(result[0]);
    } catch (error: any) {
      console.error("Error updating bar:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Soft-delete a kava bar (sets deleted_at instead of removing the row)
  app.delete("/api/admin/bars/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.params;
    const barId = parseInt(id);

    if (isNaN(barId)) {
      return res.status(400).json({ error: "Invalid bar ID" });
    }

    try {
      const existingBar = await db.query.kavaBars.findFirst({
        where: eq(kavaBars.id, barId),
      });

      if (!existingBar) {
        return res.status(404).json({ error: "Bar not found" });
      }

      // Soft delete — set deleted_at timestamp instead of removing
      await db.execute(
        sql`UPDATE kava_bars SET deleted_at = NOW() WHERE id = ${barId}`
      );

      console.log(`Bar ${barId} (${existingBar.name}) soft-deleted by user ${req.user.id}`);
      res.json({ success: true, message: "Bar archived successfully. It can be restored by an admin." });
    } catch (error: any) {
      console.error("Error archiving bar:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Restore a soft-deleted bar
  app.post("/api/admin/bars/:id/restore", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const barId = parseInt(req.params.id);
    if (isNaN(barId)) {
      return res.status(400).json({ error: "Invalid bar ID" });
    }

    try {
      const result = await db.execute(
        sql`UPDATE kava_bars SET deleted_at = NULL WHERE id = ${barId} RETURNING id, name`
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Bar not found" });
      }
      res.json({ success: true, message: "Bar restored successfully" });
    } catch (error: any) {
      console.error("Error restoring bar:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/verification-requests/:id/approve", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const requestId = Number(req.params.id);
      if (isNaN(requestId)) {
        return res.status(400).json({ error: "Invalid request ID" });
      }

      // Get the verification request
      const [request] = await db
        .select()
        .from(verificationRequests)
        .where(eq(verificationRequests.id, requestId))
        .limit(1);

      if (!request) {
        return res
          .status(404)
          .json({ error: "Verification request not found" });
      }

      if (!request.requesterId) {
        return res
          .status(400)
          .json({ error: "Request is missing requesterId" });
      }

      // Update verification request status
      await db
        .update(verificationRequests)
        .set({
          status: "approved",
          updatedAt: new Date(),
        })
        .where(eq(verificationRequests.id, requestId));

      // Update bar ownership
      const [updatedBar] = await db
        .update(kavaBars)
        .set({
          ownerId: request.requesterId,
          verificationStatus: "verified",
          lastVerified: new Date(),
        })
        .where(eq(kavaBars.id, request.barId))
        .returning();

      if (!updatedBar) {
        throw new Error("Failed to update bar ownership");
      }

      // Update user role
      await db
        .update(users)
        .set({
          role: "bar_owner",
          updatedAt: new Date(),
        })
        .where(eq(users.id, request.requesterId));

      // Generate a verification code
      const code = `VERIFY-${request.barId}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Create verification code
      const [verificationCode] = await db
        .insert(verificationCodes)
        .values({
          barId: request.barId,
          code,
          expiresAt,
        })
        .returning();

      if (!verificationCode) {
        throw new Error("Failed to create verification code");
      }

      // Log user activity
      await db.insert(userActivityLogs).values({
        userId: request.requesterId,
        activityType: "role_change",
        details: {
          from: "regular_user",
          to: "bar_owner",
          reason: "Verification request approved",
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({
        success: true,
        message: "Verification request approved and ownership updated",
      });
    } catch (error: any) {
      console.error("Error approving verification request:", error);
      res.status(500).json({
        error: "Failed to approve verification request",
        details: error.message,
      });
    }
  });

  app.post("/api/admin/bars/:id/remove-owner", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    const barId = Number(req.params.id);

    try {
      // Get the bar and its current owner
      const [bar] = await db
        .select()
        .from(kavaBars)
        .where(eq(kavaBars.id, barId))
        .limit(1);
      console.log("Bar found ", bar);
      if (!bar) {
        return res.status(404).send("Bar not found");
      }

      if (!bar.ownerId) {
        return res.status(400).send("Bar has no owner");
      }

      if (bar.ownerId == req.user.id)
        return res.status(400).send("You cannot remove your own owner");

      const previousOwnerId = bar.ownerId;

      // Step 1: Remove bar ownership
      const [updatedBar] = await db
        .update(kavaBars)
        .set({
          ownerId: null,
          updatedAt: new Date(),
        })
        .where(eq(kavaBars.id, barId))
        .returning();

      if (!updatedBar) {
        throw new Error("Failed to remove bar owner");
      }

      // Step 2: Update user role back to regular user
      const [updatedUser] = await db
        .update(users)
        .set({
          role: "user",
          updatedAt: new Date(),
        })
        .where(eq(users.id, previousOwnerId))
        .returning();

      if (!updatedUser) {
        throw new Error("Failed to update user role");
      }

      // Step 3: Log the ownership removal
      await db.insert(userActivityLogs).values({
        userId: previousOwnerId,
        activityType: "role_change",
        details: {
          from: "bar_owner",
          to: "user",
          reason: "Admin removed bar ownership",
          adminId: req.user.id,
          barId: barId,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({
        success: true,
        message: "Bar ownership removed successfully",
      });
    } catch (error: any) {
      console.error("Error removing bar owner:", error);
      res
        .status(500)
        .json({ error: "Failed to remove bar owner", details: error.message });
    }
  });

  app.post("/api/admin/verification-requests/:id/deny", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const requestId = Number(req.params.id);
      if (isNaN(requestId)) {
        return res.status(400).json({ error: "Invalid request ID" });
      }

      // Update the verification request status
      const [updatedRequest] = await db
        .update(verificationRequests)
        .set({
          status: "denied",
          updatedAt: new Date(),
        })
        .where(eq(verificationRequests.id, requestId))
        .returning();

      if (!updatedRequest) {
        return res
          .status(404)
          .json({ error: "Verification request not found" });
      }

      res.json({
        success: true,
        message: "Verification request denied successfully",
      });
    } catch (error: any) {
      console.error("Error denying verification request:", error);
      res.status(500).json({
        error: "Failed to deny verification request",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  // Add this new endpoint after the existing admin endpoints
  app.post("/api/admin/fetch-california-bars", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      const result = await fetchCaliforniaKavaBars();
      res.json({
        message: "Successfully fetched California kava bar data",
        stats: result,
      });
    } catch (error: any) {
      console.error("Error fetching California kava bar data:", error);
      res.status(500).json({ error: error.message });
    }
  });
  // Add this new endpoint after the existing verification endpoints
  app.post("/api/admin/fetch-western-bars", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin accessrequired");
    }

    try {
      console.log("Starting western states kava bars search...");
      const results = await fetchWesternKavaBars();
      res.json({
        message: "Successfully fetched western states kava bar data",
        results,
      });
    } catch (error: any) {
      console.error("Error fetching western states kava bar data:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add this new endpoint after the existing admin endpoints
  app.post("/api/admin/fetch-state-bars/:state", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    const { state } = req.params;
    const validStates = ["Tennessee", "Nevada", "New Mexico", "Utah"];
    if (!validStates.includes(state)) {
      return res.status(400).json({
        error: "Invalid state",
        validStates,
      });
    }

    try {
      console.log(`Starting ${state} kava bars search...`);
      const results = await fetchStateData(state);

      // Add a delay to ensure database changes are reflected
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get updated bar count for the state
      const stateBarCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM kava_bars
        WHERE deleted_at IS NULL AND address ILIKE ${`%${state}%`}
      `);

      res.json({
        message: `Successfully fetched ${state} kava bar data`,
        results,
        barCount: stateBarCount.rows[0].count,
      });
    } catch (error: any) {
      console.error(`Error fetching ${state} kava bar data:`, error);
      res.status(500).json({ error: error.message });
    }
  });
  //  // Add this endpoint after the existing admin endpoints
  app.post("/api/admin/restore-states", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      // Start the restoration process
      console.log("Starting state data restoration process...");
      const results = await restoreAllStates();

      res.json({
        message: "State restoration process completed",
        results,
      });
    } catch (error: any) {
      console.error("Error during state restoration:", error);
      res.status(500).json({
        error: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });
  app.post("/api/admin/restore-target-states", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    const targetStates = ["Tennessee", "Nevada", "New Mexico", "Utah"];

    try {
      console.log("Starting targeted state restoration process...");
      const results = await restoreAllStates(true, targetStates);

      res.json({
        message: "Targeted state restoration completed",
        results,
      });
    } catch (error: any) {
      console.error("Error during targeted state restoration:", error);
      res.status(500).json({
        error: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });
  app.post("/api/admin/restore-all-states", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      console.log("Starting complete state restoration process...");

      // Import the restore function that handles all states
      const results = await restoreAllStates();

      // Get current state distribution after restoration
      const stateDistribution = await db.execute(sql`
        SELECT
          CASE
            WHEN address ILIKE '%florida%' OR address ILIKE '%, fl%' THEN 'Florida'
            WHEN address ILIKE '%texas%' OR address ILIKE '%, tx%' THEN 'Texas'
            WHEN address ILIKE '%arizona%' OR address ILIKE '%, az%' THEN 'Arizona'
            WHEN address ILIKE '%arkansas%' OR address ILIKE '%, ar%' THEN 'Arkansas'
            WHEN address ILIKE '%georgia%' OR address ILIKE '%, ga%' THEN 'Georgia'
            WHEN address ILIKE '%louisiana%' OR address ILIKE '%, la%' THEN 'Louisiana'
            WHEN address ILIKE '%mississippi%' OR address ILIKE '%, ms%' THEN 'Mississippi'
            WHEN address ILIKE '%north carolina%' OR address ILIKE '%, nc%' THEN 'North Carolina'
            WHEN address ILIKE '%south carolina%' OR address ILIKE '%, sc%' THEN 'South Carolina'
            WHEN address ILIKE '%virginia%' OR address ILIKE '%, va%' THEN 'Virginia'
            WHEN address ILIKE '%tennessee%' OR address ILIKE '%, tn%' THEN 'Tennessee'
            WHEN address ILIKE '%nevada%' OR address ILIKE '%, nv%' THEN 'Nevada'
            WHEN address ILIKE '%new mexico%' OR address ILIKE '%, nm%' THEN 'New Mexico'
            WHEN address ILIKE '%utah%' OR address ILIKE '%, ut%' THEN 'Utah'
            WHEN address ILIKE '%oklahoma%' OR address ILIKE '%, ok%' THEN 'Oklahoma'
            WHEN address ILIKE '%alabama%' OR address ILIKE '%, al%' THEN 'Alabama'
            ELSE 'Other'
          END as state,
          COUNT(*) as bar_count,
          COUNT(CASE WHEN verification_status = 'verified_kava_bar' THEN 1 END) as verified_count
        FROM kava_bars
        WHERE deleted_at IS NULL
        GROUP BY state
        ORDER BY bar_count DESC
      `);

      res.json({
        message: "State restoration process completed",
        results,
        currentDistribution: stateDistribution.rows,
      });
    } catch (error: any) {
      console.error("Error during state restoration:", error);
      res.status(500).json({
        error: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });

  // Add photo upload and retrieval endpoints after the existing bar routes
  app.post(
    "/api/bars/:id/photos",
    isPhoneVerifiedMiddleware,
    upload.single("photo"),
    async (req, res) => {
      try {
        console.log("Photo upload request received", {
          authenticated: req.isAuthenticated(),
          hasFile: !!req.file,
          fileSize: req.file ? req.file.size : 0,
          barId: req.params.id,
        });

        if (!req.user) {
          console.log("User not authenticated");
          return res.status(401).send("Not authenticated");
        }

        if (!req.file) {
          console.log("No file uploaded");
          return res.status(400).send("No photo uploaded");
        }

        const barId = Number(req.params.id);
        console.log("Processing photo upload for bar:", barId);

        // Process the uploaded image with Sharp
        const processedImageBuffer = await sharp(req.file.buffer)
          .resize(1200, null, {
            withoutEnlargement: true,
            fit: "inside",
          })
          .jpeg({ quality: 80 })
          .toBuffer();

        console.log("Image processed successfully");

        // Generate a unique filename
        const filename = `${barId}-${randomUUID()}.jpg`;

        // Use the uploadImageToStorage function from your utility
        const { publicUrl } = await uploadImageToStorage(
          processedImageBuffer,
          filename,
        );

        console.log("Image uploaded to storage:", publicUrl);

        // Save photo record in database
        const [photo] = await db
          .insert(kavaBarPhotos)
          .values({
            barId,
            url: publicUrl,
            uploadedById: req.user.id,
            caption: req.body.caption || null,
          })
          .returning();

        console.log("Saved photo to database:", photo);
        res.status(201).json(photo);
      } catch (error: any) {
        console.error("Photo upload error:", error);
        res.status(500).json({ error: error.message });
      }
    },
  );

  app.get("/api/bars/:id/photos", async (req, res) => {
    try {
      const barId = Number(req.params.id);
      console.log("Fetching photos for bar:", barId);

      const photos = await db.query.kavaBarPhotos.findMany({
        where: eq(kavaBarPhotos.barId, barId),
        orderBy: desc(kavaBarPhotos.createdAt),
      });

      console.log("Found photos:", photos);
      res.json(photos);
    } catch (error: any) {
      console.error("Error fetching photos:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/bars/:barId/photos/:photoId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).send("Not authenticated");
      }

      const barId = Number(req.params.barId);
      const photoId = Number(req.params.photoId);

      // Get the bar to check ownership
      const [bar] = await db
        .select()
        .from(kavaBars)
        .where(eq(kavaBars.id, barId))
        .limit(1);

      if (!bar) {
        return res.status(404).json({ error: "Bar not found" });
      }

      // Check if user is admin or bar owner
      if (!req.user.isAdmin && req.user.id !== bar.ownerId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Get photo details
      const [photo] = await db
        .select()
        .from(kavaBarPhotos)
        .where(eq(kavaBarPhotos.id, photoId))
        .limit(1);

      if (!photo) {
        return res.status(404).json({ error: "Photo not found" });
      }

      // Delete the photo file
      if (photo.url.startsWith("/uploads/")) {
        const filePath = path.join(process.cwd(), "public", photo.url);
        await fs.unlink(filePath);
      }

      // Delete the database record
      await db.delete(kavaBarPhotos).where(eq(kavaBarPhotos.id, photoId));

      res.json({ message: "Photo deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting photo:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/user/password", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Get current user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Import crypto utility
      const { crypto } = await import("./utils/crypto");

      // Verify current password
      const isMatch = await crypto.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await crypto.hash(newPassword);

      // Update password
      await db
        .update(users)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Password update error:", error);
      res.status(500).json({ error: "Failed to update password" });
    }
  });

  app.put(
    "/api/user/profile",
    upload.single("profilePhoto"),
    async (req, res) => {},
  );

  // Admin endpoints for bar verification
  app.put("/api/admin/bars/:id/verify", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    const barId = Number(req.params.id);

    try {
      const [bar] = await db
        .update(kavaBars)
        .set({
          verificationStatus: "verified_kava_bar",
          lastVerified: new Date(),
        })
        .where(eq(kavaBars.id, barId))
        .returning();

      if (!bar) {
        return res.status(404).send("Bar not found");
      }

      res.json(bar);
    } catch (error: any) {
      console.error("Error verifying bar:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/admin/verification-requests/:id/deny", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const requestId = Number(req.params.id);
      if (isNaN(requestId)) {
        return res.status(400).json({ error: "Invalid request ID" });
      }

      // Update the verification request status
      const [updatedRequest] = await db
        .update(verificationRequests)
        .set({
          status: "denied",
          updatedAt: new Date(),
        })
        .where(eq(verificationRequests.id, requestId))
        .returning();

      if (!updatedRequest) {
        return res
          .status(404)
          .json({ error: "Verification request not found" });
      }

      res.json({
        success: true,
        message: "Verification request denied successfully",
      });
    } catch (error: any) {
      console.error("Error denying verification request:", error);
      res.status(500).json({
        error: "Failed to deny verification request",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  app.get("/api/kavatenders/:barId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { barId } = req.params;
      const userId = req.user.id; // Get the logged-in user ID

      if (!barId || isNaN(Number(barId))) {
        return res.status(400).json({ error: "Invalid bar ID" });
      }

      // Ensure the logged-in user is the owner of the kava bar
      const [bar] = await db
        .select({ ownerId: kavaBars.ownerId })
        .from(kavaBars)
        .where(eq(kavaBars.id, Number(barId)))
        .limit(1);

      if (!bar) {
        console.log("Kava bar not found");
        return res.status(404).json({ error: "Kava bar not found" });
      }

      if (bar.ownerId !== userId && !req.user.isAdmin) {
        console.log("User is not the owner of the kava bar");
        return res.status(403).json({
          error: "You are not authorized to view this bar's kavatenders",
        });
      }

      // Fetch kavatenders for the given barId
      const kavatenders = await db
        .select({
          userId: users.id,
          name: users.username, // Optionally concatenate firstName + lastName
          phoneNumber: users.phoneNumber,
          position: barStaff.position,
          isActive: barStaff.isActive,
          hireDate: barStaff.hireDate,
        })
        .from(barStaff)
        .innerJoin(users, eq(barStaff.userId, users.id))
        .where(eq(barStaff.barId, Number(barId)));

      res.json(kavatenders);
    } catch (error: any) {
      console.error(`Error getting kavatenders:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/kavatenders/:barId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { barId } = req.params;
      const { userId } = req.body;
      const ownerId = req.user.id; // Get the logged-in user ID

      if (!barId || isNaN(Number(barId))) {
        return res.status(400).json({ error: "Invalid bar ID" });
      }
      if (!userId || isNaN(Number(userId))) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      // Ensure the logged-in user is the owner of the kava bar
      const [bar] = await db
        .select({ ownerId: kavaBars.ownerId })
        .from(kavaBars)
        .where(eq(kavaBars.id, Number(barId)))
        .limit(1);

      if (!bar) {
        return res.status(404).json({ error: "Kava bar not found" });
      }

      if (bar.ownerId !== ownerId && !req.user.isAdmin) {
        return res.status(403).json({
          error: "You are not authorized to remove kavatenders from this bar",
        });
      }

      // Delete the kavatender from the barStaff table
      await db.delete(barStaff).where(eq(barStaff.userId, Number(userId)));

      // Update the user's role to "regular_user"
      await db
        .update(users)
        .set({ role: "regular_user" })
        .where(eq(users.id, Number(userId)));

      return res.json({
        success: true,
        message: "Kavatender removed and role updated",
      });
    } catch (error: any) {
      console.error(`Error removing kavatender:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/kavatenders/verify", async (req, res) => {
    try {
      console.log("Received kavatender verification request:", {
        authenticated: req.isAuthenticated(),
        user: req.user,
        session: req.session,
        body: {
          ...req.body,
          phoneNumber: req.body.phoneNumber ? "[REDACTED]" : undefined,
        },
      });

      if (!req.isAuthenticated()) {
        console.log("Authentication failed - user not authenticated", {
          session: req.session,
          user: req.user,
        });
        return res
          .status(401)
          .json({ error: "Authentication required. Please log in." });
      }
      const { phoneNumber, barId } = req.body;

      if (!phoneNumber || !barId) {
        return res.status(400).json({
          error: "Missing required fields",
          details: "Phone number and bar ID are required",
        });
      }

      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }
      if (!barId) {
        return res.status(400).json({ error: "Bar ID is required" });
      }

      // Check if user is a bar owner and owns this bar
      const [bar] = await db
        .select()
        .from(kavaBars)
        .where(and(eq(kavaBars.id, Number(barId))))
        .limit(1);
      console.log("Bar found:", bar);
      if (bar.ownerId !== req.user.id && !req.user.isAdmin) {
        return res
          .status(403)
          .json({ error: "Not authorized to verify kavatenders for this bar" });
      }

      let formattedNumber;
      try {
        formattedNumber = formatToE164(phoneNumber);
        console.log("Looking up user with phone number:", formattedNumber);
      } catch (error) {
        return res.status(400).json({
          error: "Invalid phone number format",
          details: "Please enter a valid US phone number",
        });
      }

      // Find the user with this phone number and log all relevant details
      console.log(
        "Looking up user with formatted phone number:",
        formattedNumber,
      );

      const activeUserCheck = await db
        .select({
          id: users.id,
          username: users.username,
          phoneNumber: users.phoneNumber,
          isPhoneVerified: users.isPhoneVerified,
          role: users.role,
          status: users.status,
        })
        .from(users)
        .where(eq(users.phoneNumber, formattedNumber));

      console.log("User lookup details:", activeUserCheck);

      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          phoneNumber: users.phoneNumber,
          isPhoneVerified: users.isPhoneVerified,
          role: users.role,
          status: users.status,
        })
        .from(users)
        .where(eq(users.phoneNumber, formattedNumber))
        .limit(1);

      console.log(
        "User lookup result:",
        user
          ? {
              id: user.id,
              username: user.username,
              phoneNumber: user.phoneNumber,
              isPhoneVerified: user.isPhoneVerified,
              role: user.role,
              status: user.status,
            }
          : "No user found",
      );

      if (!user) {
        console.log("No user found with phone number:", formattedNumber);
        return res.status(404).json({
          error: "User not found",
          details:
            "Please ensure the kavatender has created an account with this phone number and verified it",
        });
      }

      if (!user.isPhoneVerified) {
        return res.status(400).json({
          error: "Phone not verified",
          details:
            "The kavatender must verify their phone number before they can be added",
        });
      }

      // Check if user is active
      const [activeUser] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, user.id), eq(users.status, "active")))
        .limit(1);

      if (!activeUser) {
        return res.status(400).json({ error: "User account is not active" });
      }

      // Check if already a staff member
      const [existingStaff] = await db
        .select()
        .from(barStaff)
        .where(
          and(eq(barStaff.barId, Number(barId)), eq(barStaff.userId, user.id)),
        )
        .limit(1);

      if (existingStaff) {
        return res
          .status(400)
          .json({ error: "User is already a staff member" });
      }

      // Add as bar staff
      const [newStaff] = await db
        .insert(barStaff)
        .values({
          userId: user.id,
          barId: Number(barId),
          position: "kavatender",
          isActive: true,
        })
        .returning();
      const [referralCodeExists] = await db
        .select({
          referralCode: kavatenderReferralProfiles.referralCode,
        })
        .from(kavatenderReferralProfiles)
        .where(eq(kavatenderReferralProfiles.userId, user.id))
        .limit(1);
      let referralCode;
      if (!referralCodeExists) {
        referralCode = await generateUniqueReferralCode();
        console.log(
          `Generating Referral code for the new kavatender: ${referralCode}`,
        );
        await db.insert(kavatenderReferralProfiles).values({
          userId: user.id,
          referralCode: referralCode,
          totalEarnings: 0,
        });
      }
      // Update user role
      await db
        .update(users)
        .set({
          role: "kavatender",
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      // Return the new kavatender details
      const [kavatender] = await db
        .select({
          userId: users.id,
          name: users.username,
          phoneNumber: users.phoneNumber,
          position: barStaff.position,
          isActive: barStaff.isActive,
          hireDate: barStaff.hireDate,
        })
        .from(barStaff)
        .innerJoin(users, eq(barStaff.userId, users.id))
        .where(eq(barStaff.id, newStaff.id))
        .limit(1);

      res.json(kavatender);
    } catch (error: any) {
      console.error(`Error verifying kavatender:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add this new endpoint after the existing admin endpoints
  app.post("/api/admin/fetch-california-bars", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      const result = await fetchCaliforniaKavaBars();
      res.json({
        message: "Successfully fetched California kava bar data",
        stats: result,
      });
    } catch (error: any) {
      console.error("Error fetching California kava bar data:", error);
      res.status(500).json({ error: error.message });
    }
  });
  // Add this new endpoint after the existing verification endpoints
  app.post("/api/admin/fetch-western-bars", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin accessrequired");
    }

    try {
      console.log("Starting western states kava bars search...");
      const results = await fetchWesternKavaBars();
      res.json({
        message: "Successfully fetched western states kava bar data",
        results,
      });
    } catch (error: any) {
      console.error("Error fetching western states kava bar data:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add this new endpoint after the existing admin endpoints
  app.post("/api/admin/fetch-state-bars/:state", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    const { state } = req.params;
    const validStates = ["Tennessee", "Nevada", "New Mexico", "Utah"];
    if (!validStates.includes(state)) {
      return res.status(400).json({
        error: "Invalid state",
        validStates,
      });
    }

    try {
      console.log(`Starting ${state} kava bars search...`);
      const results = await fetchStateData(state);

      // Add a delay to ensure database changes are reflected
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get updated bar count for the state
      const stateBarCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM kava_bars
        WHERE deleted_at IS NULL AND address ILIKE ${`%${state}%`}
      `);

      res.json({
        message: `Successfully fetched ${state} kava bar data`,
        results,
        barCount: stateBarCount.rows[0].count,
      });
    } catch (error: any) {
      console.error(`Error fetching ${state} kava bar data:`, error);
      res.status(500).json({ error: error.message });
    }
  });
  //  // Add this endpoint after the existing admin endpoints
  app.post("/api/admin/restore-states", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      // Start the restoration process
      console.log("Starting state data restoration process...");
      const results = await restoreAllStates();

      res.json({
        message: "State restoration process completed",
        results,
      });
    } catch (error: any) {
      console.error("Error during state restoration:", error);
      res.status(500).json({
        error: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });
  app.post("/api/admin/restore-target-states", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    const targetStates = ["Tennessee", "Nevada", "New Mexico", "Utah"];

    try {
      console.log("Starting targeted state restoration process...");
      const results = await restoreAllStates(true, targetStates);

      res.json({
        message: "Targeted state restoration completed",
        results,
      });
    } catch (error: any) {
      console.error("Error during targeted state restoration:", error);
      res.status(500).json({
        error: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });
  app.post("/api/admin/restore-all-states", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      console.log("Starting complete state restoration process...");

      // Import the restore function that handles all states
      const results = await restoreAllStates();

      // Get current state distribution after restoration
      const stateDistribution = await db.execute(sql`
        SELECT
          CASE
            WHEN address ILIKE '%florida%' OR address ILIKE '%, fl%' THEN 'Florida'
            WHEN address ILIKE '%texas%' OR address ILIKE '%, tx%' THEN 'Texas'
            WHEN address ILIKE '%arizona%' OR address ILIKE '%, az%' THEN 'Arizona'
            WHEN address ILIKE '%arkansas%' OR address ILIKE '%, ar%' THEN 'Arkansas'
            WHEN address ILIKE '%georgia%' OR address ILIKE '%, ga%' THEN 'Georgia'
            WHEN address ILIKE '%louisiana%' OR address ILIKE '%, la%' THEN 'Louisiana'
            WHEN address ILIKE '%mississippi%' OR address ILIKE '%, ms%' THEN 'Mississippi'
            WHEN address ILIKE '%north carolina%' OR address ILIKE '%, nc%' THEN 'North Carolina'
            WHEN address ILIKE '%south carolina%' OR address ILIKE '%, sc%' THEN 'South Carolina'
            WHEN address ILIKE '%virginia%' OR address ILIKE '%, va%' THEN 'Virginia'
            WHEN address ILIKE '%tennessee%' OR address ILIKE '%, tn%' THEN 'Tennessee'
            WHEN address ILIKE '%nevada%' OR address ILIKE '%, nv%' THEN 'Nevada'
            WHEN address ILIKE '%new mexico%' OR address ILIKE '%, nm%' THEN 'New Mexico'
            WHEN address ILIKE '%utah%' OR address ILIKE '%, ut%' THEN 'Utah'
            WHEN address ILIKE '%oklahoma%' OR address ILIKE '%, ok%' THEN 'Oklahoma'
            WHEN address ILIKE '%alabama%' OR address ILIKE '%, al%' THEN 'Alabama'
            ELSE 'Other'
          END as state,
          COUNT(*) as bar_count,
          COUNT(CASE WHEN verification_status = 'verified_kava_bar' THEN 1 END) as verified_count
        FROM kava_bars
        WHERE deleted_at IS NULL
        GROUP BY state
        ORDER BY bar_count DESC
      `);

      res.json({
        message: "State restoration process completed",
        results,
        currentDistribution: stateDistribution.rows,
      });
    } catch (error: any) {
      console.error("Error during state restoration:", error);
      res.status(500).json({
        error: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });

  // Add these routes after the existing bar routes
  app.get("/api/owner/notification-preferences", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const [preferences] =
        await db.query.barOwnerNotificationPreferences.findMany({
          where: eq(barOwnerNotificationPreferences.userId, req.user.id),
          limit: 1,
        });

      // If no preferences exist, create default preferences
      if (!preferences) {
        const [newPreferences] = await db
          .insert(barOwnerNotificationPreferences)
          .values({
            userId: req.user.id,
            reviewNotifications: true,
            photoNotifications: true,
          })
          .returning();

        return res.json(newPreferences);
      }

      res.json(preferences);
    } catch (error: any) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/owner/notification-preferences", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { reviewNotifications, photoNotifications } = req.body;
      const [preferences] =
        await db.query.barOwnerNotificationPreferences.findMany({
          where: eq(barOwnerNotificationPreferences.userId, req.user.id),
          limit: 1,
        });

      if (!preferences) {
        const [newPreferences] = await db
          .insert(barOwnerNotificationPreferences)
          .values({
            userId: req.user.id,
            reviewNotifications: reviewNotifications ?? true,
            photoNotifications: photoNotifications ?? true,
          })
          .returning();

        return res.json(newPreferences);
      }

      const [updatedPreferences] = await db
        .update(barOwnerNotificationPreferences)
        .set({
          reviewNotifications:
            reviewNotifications ?? preferences.reviewNotifications,
          photoNotifications:
            photoNotifications ?? preferences.photoNotifications,
          updatedAt: new Date(),
        })
        .where(eq(barOwnerNotificationPreferences.id, preferences.id))
        .returning();

      res.json(updatedPreferences);
    } catch (error: any) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bars/:id/check-ins", async (req, res) => {
    try {
      const barId = Number(req.params.id);
      const currentTime = new Date();
      const now = moment.tz(currentTime, "America/New_York").utc().toDate();

      // Step 1: Get all active bar staff for the given bar
      const staff = await db
        .select()
        .from(barStaff)
        .where(and(eq(barStaff.barId, barId), eq(barStaff.isActive, true)));

      // Use Set to keep unique staff IDs
      const staffIdsSet = new Set(staff.map((s) => s.id));

      // Step 2: Check if bar owner exists and is not already included
      const [bar] = await db
        .select()
        .from(kavaBars)
        .where(eq(kavaBars.id, barId));

      if (bar && bar.ownerId) {
        let [ownerStaff] = await db
          .select()
          .from(barStaff)
          .where(
            and(eq(barStaff.barId, barId), eq(barStaff.userId, bar.ownerId)),
          );

        if (!ownerStaff && req.user && req.user.id === bar.ownerId) {
          // Insert bar owner as barStaff if missing
          [ownerStaff] = await db
            .insert(barStaff)
            .values({
              barId,
              userId: bar.ownerId,
              position: "bar_owner",
              isActive: true,
            })
            .returning();
        }

        if (ownerStaff) {
          staffIdsSet.add(ownerStaff.id);
        }
      }

      // Convert Set back to array
      const staffIds = Array.from(staffIdsSet);
      console.log("Bar staff IDs (unique):", staffIds);

      if (!staffIds.length) {
        return res.json([]); // No staff => no check-ins
      }

      // Step 3: Get active check-ins for the staff IDs
      const activeCheckIns = await db
        .select()
        .from(checkIns)
        .where(
          and(
            inArray(checkIns.barStaffId, staffIds),
            lt(checkIns.startTime, now), // startTime < now
            gt(checkIns.endTime, now), // endTime > now
            eq(checkIns.isActive, true), // consider only active check-ins
          ),
        );

      console.log("Active check-ins:", activeCheckIns);

      if (!activeCheckIns.length) {
        return res.json([]); // No active check-ins
      }

      const activeStaffIds = activeCheckIns.map((c) => c.barStaffId);

      // Step 4: Fetch user details with JOIN on barStaff and users filtered by activeStaffIds
      const activeUsers = await db
        .select({
          firstName: users.firstName,
          lastName: users.lastName,
          profilePhotoUrl: users.profilePhotoUrl,
        })
        .from(users)
        .innerJoin(barStaff, eq(users.id, barStaff.userId))
        .where(inArray(barStaff.id, activeStaffIds));

      console.log("Active users:", activeUsers);
      return res.json(activeUsers);
    } catch (error: any) {
      console.error("Error fetching check-ins:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bars/:id/check-in/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { id } = req.params;
    try {
      // Find the barstaff id
      const [barStaffUser] = await db
        .select()
        .from(barStaff)
        .where(
          and(eq(barStaff.userId, req.user.id), eq(barStaff.barId, Number(id))),
        );
      if (!barStaffUser) {
        return res.status(404).json({ error: "Bar staff not found" });
      }

      const [checkIn] = await db
        .select()
        .from(checkIns)
        .where(eq(checkIns.barStaffId, barStaffUser.id))
        .orderBy(desc(checkIns.createdAt))
        .limit(1);
      console.log("\n\n\nBar staff id ", barStaffUser.id);
      console.log("User id ", req.user.id);
      console.log("Bar id ", id);
      console.log("Check in ", checkIn);
      if (!checkIn) {
        return res.status(404).json({ error: "Check in not found" });
      }

      const currentTimeUTC = new Date();
      const endTimeUTC = new Date(checkIn.endTime);
      const isActive = currentTimeUTC < endTimeUTC;

      // Send the UTC time to the client
      const checkInData = {
        ...checkIn,
        isActive,
        endTime: endTimeUTC.toISOString(),
      };
      console.log("Check in data ", checkInData);
      res.json(checkInData);
    } catch (error: any) {
      console.error("Error checking in:", error);
      res.status(500).json({ error: "Failed to check in" });
    }
  });

  app.post("/api/bars/:id/check-in", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { endTime } = req.body;
    try {
      // Create Date objects
      const currentTimeUTC = new Date();
      const endTimeUTC = moment.tz(endTime, "America/New_York").utc().toDate();

      console.log({
        receivedEndTime: endTime,
        endTimeLocal: moment.tz(endTime, "America/New_York").format(),
        endTimeUTC: endTimeUTC.toISOString(),
        currentTimeUTC: currentTimeUTC.toISOString(),
      });

      if (endTimeUTC < currentTimeUTC) {
        return res
          .status(400)
          .json({ error: "End time must be greater than the current time" });
      }

      // Find the barstaff id
      let [barStaffUser] = await db
        .select()
        .from(barStaff)
        .where(
          and(
            eq(barStaff.userId, req.user.id),
            eq(barStaff.barId, parseInt(req.params.id)),
          ),
        );
      if (!barStaffUser) {
        console.log("Bar staff user not found");
        const [isBarOwner] = await db
          .select()
          .from(kavaBars)
          .where(
            and(
              eq(kavaBars.ownerId, req.user.id),
              eq(kavaBars.id, parseInt(req.params.id)),
            ),
          );
        console.log(`Bar staff user `, barStaffUser);
        if (!isBarOwner) {
          console.log("User is not a bar owner ", req.user.id);
          return res.status(404).json({ error: "Bar staff not found" });
        }
        console.log("Creating bar staff user ", req.user.id);
        [barStaffUser] = await db
          .insert(barStaff)
          .values({
            userId: req.user.id,
            barId: isBarOwner.id,
          })
          .returning();
      }

      const [checkInRes] = await db
        .insert(checkIns)
        .values({
          barStaffId: barStaffUser.id,
          endTime: endTimeUTC,
        })
        .returning();
      console.log("Check in created ", checkInRes);

      return res.json({ success: true });
    } catch (error: any) {
      console.error("Error checking in:", error);
      res.status(500).json({ error: "Failed to check in" });
    }
  });

  // Add these routes after the existing bar routes

  app.post("/api/bars/:id/kavatenders", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const barId = Number(req.params.id);
    const { phoneNumber } = req.body;

    try {
      // Verify the phone number format
      const formattedNumber = formatToE164(phoneNumber);

      // Create kavatender record
      const [kavatender] = await db
        .insert(kavatenders)
        .values({
          barId,
          phoneNumber: formattedNumber,
          status: "pending",
        })
        .returning();

      // Send verification code
      const verificationResult = await sendVerificationCode(formattedNumber);

      res.json({
        success: true,
        kavatenderId: kavatender.id,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  });
  app.put("/api/kava-bars/:id/opening", isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { comingSoon, grandOpeningDate } = req.body;

    if (!req.user || !req.user.id)
      return res.status(403).json({ error: "Unauthorized" });
    if (typeof comingSoon !== "boolean") {
      return res.status(400).json({ error: "'comingSoon' must be a boolean" });
    }

    const userId =
      typeof req.user.id === "string" ? parseInt(req.user.id, 10) : req.user.id;

    let isAuthorized = false;
    if (req.user.isAdmin) {
      isAuthorized = true;
    } else {
      const bar = await db
        .select({ id: kavaBars.id })
        .from(kavaBars)
        .where(and(eq(kavaBars.id, Number(id)), eq(kavaBars.ownerId, userId)))
        .limit(1);
      isAuthorized = bar.length > 0;
    }
    if (!isAuthorized) return res.status(403).json({ error: "Unauthorized" });

    let comingSoonBoolean = comingSoon; // use the incoming value directly
    let grandOpeningDateValue: string | null = null; // default null

    // Only validate and set date if comingSoon is true
    if (comingSoon) {
      if (!grandOpeningDate) {
        // If comingSoon true but no date provided, keep null or return error (optional)
        grandOpeningDateValue = null;
      } else {
        let dateObj = new Date(grandOpeningDate);
        if (isNaN(dateObj.getTime())) {
          return res.status(400).json({
            error: "'grandOpeningDate' must be a valid date string or null",
          });
        }

        const today = startOfDay(new Date());

        const diffDays = differenceInDays(dateObj, today);
        if (diffDays < 1) {
          return res.status(400).json({
            error:
              "'grandOpeningDate' must be at least 1 day after the current date",
          });
        }
        // Add 1 day to grandOpeningDate
        dateObj = addDays(dateObj, 1);

        // Format date to YYYY-MM-DD (local)
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
        const dd = String(dateObj.getDate()).padStart(2, "0");
        grandOpeningDateValue = `${yyyy}-${mm}-${dd}`;
      }
    } else {
      // comingSoon is false => clear the date
      comingSoonBoolean = false;
      grandOpeningDateValue = null;
    }

    try {
      await db
        .update(kavaBars)
        .set({
          comingSoon: comingSoonBoolean,
          grandOpeningDate: grandOpeningDateValue, // null when comingSoon false
        })
        .where(eq(kavaBars.id, Number(id)));

      return res
        .status(200)
        .json({ message: "Bar details updated successfully" });
    } catch (err) {
      console.error("Error updating bar details:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/kava-bars/:id/sponsor", async (req, res) => {
    const barId = Number(req.params.id);
    try {
      console.log("req.isAuthenticated()", req.isAuthenticated());
      console.log("req.user", req.user);
      if (!req.isAuthenticated()) {
        console.log("Not authenticated");
        return res.status(401).send("Not authenticated");
      }
      console.log("req.user", req.user);
      const bar = await db.query.kavaBars.findFirst({
        where: eq(kavaBars.id, barId),
      });
      console.log("bar", bar);
      if (!bar) {
        console.log("Kava bar not found");
        return res.status(404).send("Kava bar not found");
      }
      if (bar.ownerId !== req.user.id) {
        console.log("Unauthorized");
        return res.status(403).send("Unauthorized");
      }
      await db
        .update(kavaBars)
        .set({ isSponsored: true })
        .where(eq(kavaBars.id, barId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error fetching kava bar:", error);
      res.status(500).json({ error: "Failed to sponsor kava bar" });
    }
  });

  // Admin endpoints for bar verification
  app.put("/api/admin/bars/:id/verify", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    const barId = Number(req.params.id);

    try {
      const [bar] = await db
        .update(kavaBars)
        .set({
          verificationStatus: "verified_kava_bar",
          lastVerified: new Date(),
        })
        .where(eq(kavaBars.id, barId))
        .returning();

      if (!bar) {
        return res.status(404).send("Bar not found");
      }

      res.json(bar);
    } catch (error: any) {
      console.error("Error verifying bar:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/admin/verification-requests/:id/deny", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const requestId = Number(req.params.id);
      if (isNaN(requestId)) {
        return res.status(400).json({ error: "Invalid request ID" });
      }

      // Update the verification request status
      const [updatedRequest] = await db
        .update(verificationRequests)
        .set({
          status: "denied",
          updatedAt: new Date(),
        })
        .where(eq(verificationRequests.id, requestId))
        .returning();

      if (!updatedRequest) {
        return res
          .status(404)
          .json({ error: "Verification request not found" });
      }

      res.json({
        success: true,
        message: "Verification request denied successfully",
      });
    } catch (error: any) {
      console.error("Error denying verification request:", error);
      res.status(500).json({
        error: "Failed to deny verification request",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  // Add this new endpoint after the existing admin endpoints
  app.post("/api/admin/fetch-california-bars", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      const result = await fetchCaliforniaKavaBars();
      res.json({
        message: "Successfully fetched California kava bar data",
        stats: result,
      });
    } catch (error: any) {
      console.error("Error fetching California kava bar data:", error);
      res.status(500).json({ error: error.message });
    }
  });
  // Add this new endpoint after the existing verification endpoints
  app.post("/api/admin/fetch-western-bars", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin accessrequired");
    }

    try {
      console.log("Starting western states kava bars search...");
      const results = await fetchWesternKavaBars();
      res.json({
        message: "Successfully fetched western states kava bar data",
        results,
      });
    } catch (error: any) {
      console.error("Error fetching western states kava bar data:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add this new endpoint after the existing admin endpoints
  app.post("/api/admin/fetch-state-bars/:state", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    const { state } = req.params;
    const validStates = ["Tennessee", "Nevada", "New Mexico", "Utah"];
    if (!validStates.includes(state)) {
      return res.status(400).json({
        error: "Invalid state",
        validStates,
      });
    }

    try {
      console.log(`Starting ${state} kava bars search...`);
      const results = await fetchStateData(state);

      // Add a delay to ensure database changes are reflected
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get updated bar count for the state
      const stateBarCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM kava_bars
        WHERE deleted_at IS NULL AND address ILIKE ${`%${state}%`}
      `);

      res.json({
        message: `Successfully fetched ${state} kava bar data`,
        results,
        barCount: stateBarCount.rows[0].count,
      });
    } catch (error: any) {
      console.error(`Error fetching ${state} kava bar data:`, error);
      res.status(500).json({ error: error.message });
    }
  });
  //  // Add this endpoint after the existing admin endpoints
  app.post("/api/admin/restore-states", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      // Start the restoration process
      console.log("Starting state data restoration process...");
      const results = await restoreAllStates();

      res.json({
        message: "State restoration process completed",
        results,
      });
    } catch (error: any) {
      console.error("Error during state restoration:", error);
      res.status(500).json({
        error: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });
  app.post("/api/admin/restore-target-states", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    const targetStates = ["Tennessee", "Nevada", "New Mexico", "Utah"];

    try {
      console.log("Starting targeted state restoration process...");
      const results = await restoreAllStates(true, targetStates);

      res.json({
        message: "Targeted state restoration completed",
        results,
      });
    } catch (error: any) {
      console.error("Error during targeted state restoration:", error);
      res.status(500).json({
        error: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });
  app.post("/api/admin/restore-all-states", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      console.log("Starting complete state restoration process...");

      // Import the restore function that handles all states
      const results = await restoreAllStates();

      // Get current state distribution after restoration
      const stateDistribution = await db.execute(sql`
        SELECT
          CASE
            WHEN address ILIKE '%florida%' OR address ILIKE '%, fl%' THEN 'Florida'
            WHEN address ILIKE '%texas%' OR address ILIKE '%, tx%' THEN 'Texas'
            WHEN address ILIKE '%arizona%' OR address ILIKE '%, az%' THEN 'Arizona'
            WHEN address ILIKE '%arkansas%' OR address ILIKE '%, ar%' THEN 'Arkansas'
            WHEN address ILIKE '%georgia%' OR address ILIKE '%, ga%' THEN 'Georgia'
            WHEN address ILIKE '%louisiana%' OR address ILIKE '%, la%' THEN 'Louisiana'
            WHEN address ILIKE '%mississippi%' OR address ILIKE '%, ms%' THEN 'Mississippi'
            WHEN address ILIKE '%north carolina%' OR address ILIKE '%, nc%' THEN 'North Carolina'
            WHEN address ILIKE '%south carolina%' OR address ILIKE '%, sc%' THEN 'South Carolina'
            WHEN address ILIKE '%virginia%' OR address ILIKE '%, va%' THEN 'Virginia'
            WHEN address ILIKE '%tennessee%' OR address ILIKE '%, tn%' THEN 'Tennessee'
            WHEN address ILIKE '%nevada%' OR address ILIKE '%, nv%' THEN 'Nevada'
            WHEN address ILIKE '%new mexico%' OR address ILIKE '%, nm%' THEN 'New Mexico'
            WHEN address ILIKE '%utah%' OR address ILIKE '%, ut%' THEN 'Utah'
            WHEN address ILIKE '%oklahoma%' OR address ILIKE '%, ok%' THEN 'Oklahoma'
            WHEN address ILIKE '%alabama%' OR address ILIKE '%, al%' THEN 'Alabama'
            ELSE 'Other'
          END as state,
          COUNT(*) as bar_count,
          COUNT(CASE WHEN verification_status = 'verified_kava_bar' THEN 1 END) as verified_count
        FROM kava_bars
        WHERE deleted_at IS NULL
        GROUP BY state
        ORDER BY bar_count DESC
      `);

      res.json({
        message: "State restoration process completed",
        results,
        currentDistribution: stateDistribution.rows,
      });
    } catch (error: any) {
      console.error("Error during state restoration:", error);
      res.status(500).json({
        error: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });

  app.delete("/api/bars/:barId/photos/:photoId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).send("Not authenticated");
      }

      const barId = Number(req.params.barId);
      const photoId = Number(req.params.photoId);

      // Get the bar to check ownership
      const [bar] = await db
        .select()
        .from(kavaBars)
        .where(eq(kavaBars.id, barId))
        .limit(1);

      if (!bar) {
        return res.status(404).json({ error: "Bar not found" });
      }

      // Check if user is admin or bar owner
      if (!req.user.isAdmin && req.user.id !== bar.ownerId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Get photo details
      const [photo] = await db
        .select()
        .from(kavaBarPhotos)
        .where(eq(kavaBarPhotos.id, photoId))
        .limit(1);

      if (!photo) {
        return res.status(404).json({ error: "Photo not found" });
      }

      // Delete the photo file
      if (photo.url.startsWith("/uploads/")) {
        const filePath = path.join(process.cwd(), "public", photo.url);
        await fs.unlink(filePath);
      }

      // Delete the database record
      await db.delete(kavaBarPhotos).where(eq(kavaBarPhotos.id, photoId));

      res.json({ message: "Photo deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting photo:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/user/password", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Get current user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Import crypto utility
      const { crypto } = await import("./utils/crypto");

      // Verify current password
      const isMatch = await crypto.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await crypto.hash(newPassword);

      // Update password
      await db
        .update(users)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Password update error:", error);
      res.status(500).json({ error: "Failed to update password" });
    }
  });

  app.put(
    "/api/user/profile",
    upload.single("profilePhoto"),
    async (req, res) => {},
  );

  // Admin endpoints for bar verification
  app.put("/api/admin/bars/:id/verify", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    const barId = Number(req.params.id);

    try {
      const [bar] = await db
        .update(kavaBars)
        .set({
          verificationStatus: "verified_kava_bar",
          lastVerified: new Date(),
        })
        .where(eq(kavaBars.id, barId))
        .returning();

      if (!bar) {
        return res.status(404).send("Bar not found");
      }

      res.json(bar);
    } catch (error: any) {
      console.error("Error verifying bar:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/admin/verification-requests/:id/deny", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const requestId = Number(req.params.id);
      if (isNaN(requestId)) {
        return res.status(400).json({ error: "Invalid request ID" });
      }

      // Update the verification request status
      const [updatedRequest] = await db
        .update(verificationRequests)
        .set({
          status: "denied",
          updatedAt: new Date(),
        })
        .where(eq(verificationRequests.id, requestId))
        .returning();

      if (!updatedRequest) {
        return res
          .status(404)
          .json({ error: "Verification request not found" });
      }

      res.json({
        success: true,
        message: "Verification request denied successfully",
      });
    } catch (error: any) {
      console.error("Error denying verification request:", error);
      res.status(500).json({
        error: "Failed to deny verification request",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  // Add these routes after the existing bar routes
  app.get("/api/owner/notification-preferences", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const [preferences] = await db
        .select()
        .from(barOwnerNotificationPreferences)
        .where(eq(barOwnerNotificationPreferences.userId, req.user.id))
        .limit(1);

      // If no preferences exist yet, create default ones
      if (!preferences) {
        const [newPreferences] = await db
          .insert(barOwnerNotificationPreferences)
          .values({
            userId: req.user.id,
            reviewNotifications: true,
            photoNotifications: true,
          })
          .returning();

        return res.json(newPreferences);
      }

      res.json(preferences);
    } catch (error: any) {
      console.error("Error fetching notification preferences:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch notification preferences" });
    }
  });

  app.put("/api/owner/notification-preferences", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { reviewNotifications, photoNotifications } = req.body;

    try {
      const [updatedPreferences] = await db
        .update(barOwnerNotificationPreferences)
        .set({
          reviewNotifications,
          photoNotifications,
          updatedAt: new Date(),
        })
        .where(eq(barOwnerNotificationPreferences.userId, req.user.id))
        .returning();

      if (!updatedPreferences) {
        // If no preferences exist, create them
        const [newPreferences] = await db
          .insert(barOwnerNotificationPreferences)
          .values({
            userId: req.user.id,
            reviewNotifications,
            photoNotifications,
          })
          .returning();

        return res.json(newPreferences);
      }

      res.json(updatedPreferences);
    } catch (error: any) {
      console.error("Error updating notification preferences:", error);
      res
        .status(500)
        .json({ error: "Failed to update notification preferences" });
    }
  });

  // Add these routes after the existing bar routes

  app.post("/api/bars/:id/kavatenders", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const barId = Number(req.params.id);
    const { phoneNumber } = req.body;

    try {
      // Verify the phone number format
      const formattedNumber = formatToE164(phoneNumber);

      // Create kavatender record
      const [kavatender] = await db
        .insert(kavatenders)
        .values({
          barId,
          phoneNumber: formattedNumber,
          status: "pending",
        })
        .returning();

      // Send verification code
      const verificationResult = await sendVerificationCode(formattedNumber);

      res.json({
        success: true,
        kavatenderId: kavatender.id,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Admin endpoints for bar verification
  app.put("/api/admin/bars/:id/verify", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    const barId = Number(req.params.id);

    try {
      const [bar] = await db
        .update(kavaBars)
        .set({
          verificationStatus: "verified_kava_bar",
          lastVerified: new Date(),
        })
        .where(eq(kavaBars.id, barId))
        .returning();

      if (!bar) {
        return res.status(404).send("Bar not found");
      }

      res.json(bar);
    } catch (error: any) {
      console.error("Error verifying bar:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/admin/verification-requests/:id/deny", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const requestId = Number(req.params.id);
      if (isNaN(requestId)) {
        return res.status(400).json({ error: "Invalid request ID" });
      }

      // Update the verification request status
      const [updatedRequest] = await db
        .update(verificationRequests)
        .set({
          status: "denied",
          updatedAt: new Date(),
        })
        .where(eq(verificationRequests.id, requestId))
        .returning();

      if (!updatedRequest) {
        return res
          .status(404)
          .json({ error: "Verification request not found" });
      }

      res.json({
        success: true,
        message: "Verification request denied successfully",
      });
    } catch (error: any) {
      console.error("Error denying verification request:", error);
      res.status(500).json({
        error: "Failed to deny verification request",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  // Add this new endpoint after the existing admin endpoints
  app.post("/api/admin/fetch-california-bars", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      const result = await fetchCaliforniaKavaBars();
      res.json({
        message: "Successfully fetched California kava bar data",
        stats: result,
      });
    } catch (error: any) {
      console.error("Error fetching California kava bar data:", error);
      res.status(500).json({ error: error.message });
    }
  });
  // Add this new endpoint after the existing verification endpoints
  app.post("/api/admin/fetch-western-bars", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin accessrequired");
    }

    try {
      console.log("Starting western states kava bars search...");
      const results = await fetchWesternKavaBars();
      res.json({
        message: "Successfully fetched western states kava bar data",
        results,
      });
    } catch (error: any) {
      console.error("Error fetching western states kava bar data:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add this new endpoint after the existing admin endpoints
  app.post("/api/admin/fetch-state-bars/:state", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    const { state } = req.params;
    const validStates = ["Tennessee", "Nevada", "New Mexico", "Utah"];
    if (!validStates.includes(state)) {
      return res.status(400).json({
        error: "Invalid state",
        validStates,
      });
    }

    try {
      console.log(`Starting ${state} kava bars search...`);
      const results = await fetchStateData(state);

      // Add a delay to ensure database changes are reflected
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get updated bar count for the state
      const stateBarCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM kava_bars
        WHERE deleted_at IS NULL AND address ILIKE ${`%${state}%`}
      `);

      res.json({
        message: `Successfully fetched ${state} kava bar data`,
        results,
        barCount: stateBarCount.rows[0].count,
      });
    } catch (error: any) {
      console.error(`Error fetching ${state} kava bar data:`, error);
      res.status(500).json({ error: error.message });
    }
  });
  //  // Add this endpoint after the existing admin endpoints
  app.post("/api/admin/restore-states", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      // Start the restoration process
      console.log("Starting state data restoration process...");
      const results = await restoreAllStates();

      res.json({
        message: "State restoration process completed",
        results,
      });
    } catch (error: any) {
      console.error("Error during state restoration:", error);
      res.status(500).json({
        error: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });
  app.post("/api/admin/restore-target-states", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    const targetStates = ["Tennessee", "Nevada", "New Mexico", "Utah"];

    try {
      console.log("Starting targeted state restoration process...");
      const results = await restoreAllStates(true, targetStates);

      res.json({
        message: "Targeted state restoration completed",
        results,
      });
    } catch (error: any) {
      console.error("Error during targeted state restoration:", error);
      res.status(500).json({
        error: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });
  app.post("/api/admin/restore-all-states", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      console.log("Starting complete state restoration process...");

      // Import the restore function that handles all states
      const results = await restoreAllStates();

      // Get current state distribution after restoration
      const stateDistribution = await db.execute(sql`
        SELECT
          CASE
            WHEN address ILIKE '%florida%' OR address ILIKE '%, fl%' THEN 'Florida'
            WHEN address ILIKE '%texas%' OR address ILIKE '%, tx%' THEN 'Texas'
            WHEN address ILIKE '%arizona%' OR address ILIKE '%, az%' THEN 'Arizona'
            WHEN address ILIKE '%arkansas%' OR address ILIKE '%, ar%' THEN 'Arkansas'
            WHEN address ILIKE '%georgia%' OR address ILIKE '%, ga%' THEN 'Georgia'
            WHEN address ILIKE '%louisiana%' OR address ILIKE '%, la%' THEN 'Louisiana'
            WHEN address ILIKE '%mississippi%' OR address ILIKE '%, ms%' THEN 'Mississippi'
            WHEN address ILIKE '%north carolina%' OR address ILIKE '%, nc%' THEN 'North Carolina'
            WHEN address ILIKE '%south carolina%' OR address ILIKE '%, sc%' THEN 'South Carolina'
            WHEN address ILIKE '%virginia%' OR address ILIKE '%, va%' THEN 'Virginia'
            WHEN address ILIKE '%tennessee%' OR address ILIKE '%, tn%' THEN 'Tennessee'
            WHEN address ILIKE '%nevada%' OR address ILIKE '%, nv%' THEN 'Nevada'
            WHEN address ILIKE '%new mexico%' OR address ILIKE '%, nm%' THEN 'New Mexico'
            WHEN address ILIKE '%utah%' OR address ILIKE '%, ut%' THEN 'Utah'
            WHEN address ILIKE '%oklahoma%' OR address ILIKE '%, ok%' THEN 'Oklahoma'
            WHEN address ILIKE '%alabama%' OR address ILIKE '%, al%' THEN 'Alabama'
            ELSE 'Other'
          END as state,
          COUNT(*) as bar_count,
          COUNT(CASE WHEN verification_status = 'verified_kava_bar' THEN 1 END) as verified_count
        FROM kava_bars
        WHERE deleted_at IS NULL
        GROUP BY state
        ORDER BY bar_count DESC
      `);

      res.json({
        message: "State restoration process completed",
        results,
        currentDistribution: stateDistribution.rows,
      });
    } catch (error: any) {
      console.error("Error during state restoration:", error);
      res.status(500).json({
        error: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });

  app.delete("/api/bars/:barId/photos/:photoId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).send("Not authenticated");
      }

      const barId = Number(req.params.barId);
      const photoId = Number(req.params.photoId);

      // Get the bar to check ownership
      const [bar] = await db
        .select()
        .from(kavaBars)
        .where(eq(kavaBars.id, barId))
        .limit(1);

      if (!bar) {
        return res.status(404).json({ error: "Bar not found" });
      }

      // Check if user is admin or bar owner
      if (!req.user.isAdmin && req.user.id !== bar.ownerId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Get photo details
      const [photo] = await db
        .select()
        .from(kavaBarPhotos)
        .where(eq(kavaBarPhotos.id, photoId))
        .limit(1);

      if (!photo) {
        return res.status(404).json({ error: "Photo not found" });
      }

      // Delete the photo file
      if (photo.url.startsWith("/uploads/")) {
        const filePath = path.join(process.cwd(), "public", photo.url);
        await fs.unlink(filePath);
      }

      // Delete the database record
      await db.delete(kavaBarPhotos).where(eq(kavaBarPhotos.id, photoId));

      res.json({ message: "Photo deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting photo:", error);
      res.status(500).json({ error: error.message });
    }
  });
  // ✅ Check if a bar is favorited
  app.get("/api/favorites/:barId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const { barId } = req.params;
      const userId = req.user.id;

      const favorite = await db
        .select()
        .from(userFavorites)
        .where(
          and(
            eq(userFavorites.barId, Number(barId)),
            eq(userFavorites.userId, userId),
          ),
        );

      return res.status(200).json({ isFavorite: favorite.length > 0 });
    } catch (error: any) {
      console.error("Error checking favorite status:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // ✅ Add a bar to favorites
  app.post("/api/favorites/:barId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const { barId } = req.params;
      const userId = req.user.id;

      // Check if the bar is already favorited
      const existingFavorite = await db
        .select()
        .from(userFavorites)
        .where(
          and(
            eq(userFavorites.barId, Number(barId)),
            eq(userFavorites.userId, userId),
          ),
        );

      if (existingFavorite.length > 0) {
        return res.status(400).json({ error: "Already favorited" });
      }

      await db.insert(userFavorites).values({
        userId,
        barId: Number(barId),
      });

      return res.status(201).json({ message: "Bar added to favorites" });
    } catch (error: any) {
      console.error("Error adding favorite:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // ✅ Remove a bar from favorites
  app.delete("/api/favorites/:barId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const { barId } = req.params;
      const userId = req.user.id;

      await db
        .delete(userFavorites)
        .where(
          and(
            eq(userFavorites.barId, Number(barId)),
            eq(userFavorites.userId, userId),
          ),
        );

      return res.status(200).json({ message: "Bar removed from favorites" });
    } catch (error: any) {
      console.error("Error removing favorite:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // RSVPing Events
  app.post(
    "/api/event-rsvp/:eventId",
    isPhoneVerifiedMiddleware,
    async (req, res) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (!req.user || !req.user.id)
        return res.status(401).json({ error: "Not authenticated" });
      const eventId = Number(req.params.eventId);
      const userId = Number(req.user.id);
      try {
        const result = await rsvpToEvent({ userId, eventId });
        return res.json(result);
      } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message });
      }
    },
  );

  app.get("/api/my-rsvps", isPhoneVerifiedMiddleware, getMyRsvps);
  app.delete("/api/event-rsvp/:rsvpId", isPhoneVerifiedMiddleware, deleteRsvp);
  app.get("/api/bar/:barId/rsvp-stats", getBarRsvpStats);

  // Bar features for admin
  app.get("/api/admin/feature-categories", requireAdmin, getCategories);
  app.get(
    "/api/admin/features/:categoryId",
    requireAdmin,
    getFeaturesByCategory,
  );
  app.post("/api/admin/features", requireAdmin, createFeature);
  app.put("/api/admin/features/:featureId", requireAdmin, updateFeature);
  app.delete("/api/admin/features/:featureId", requireAdmin, deleteFeature);

  // Bar features for bar owner
  app.get("/api/bar/:barId/features", getBarFeatures);
  app.get("/api/bar/:barId/owner/features", getOwnerBarFeatures);
  app.post("/api/bar/:barId/features", isAuthenticated, createBarFeature);
  app.put(
    "/api/bar/:barId/features/from-master",
    isAuthenticated,
    updateMasterFeaturesForBarOwner,
  );

  app.put(
    "/api/bar/:barId/features/:featureId/toggle-isFeatured",
    isAuthenticated,
    toggleFavoriteFeatures,
  );

  app.put(
    "/api/bar/:barId/features/:featureId",
    isAuthenticated,
    updateBarFeature,
  );

  app.delete(
    "/api/bar/:barId/features/:featureId",
    isAuthenticated,
    deleteBarFeature,
  );

  app.get("/api/bar/:barId/happy-hours", getHappyHoursController);
  app.put("/api/bar/:barId/happy-hours", updateHappyHoursController);

  // Kava Passport routes
  app.post("/api/passport/checkin", isAuthenticated, checkin);
  app.get("/api/passport/leaderboard", getLeaderboard);
  app.get("/api/passport/badges/:userId", getBadges);
  app.get("/api/passport/:userId", getPassport);

  app.put("/api/user/password", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Get current user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Import crypto utility
      const { crypto } = await import("./utils/crypto");

      // Verify current password
      const isMatch = await crypto.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await crypto.hash(newPassword);

      // Update password
      await db
        .update(users)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Password update error:", error);
      res.status(500).json({ error: "Failed to update password" });
    }
  });

  app.put(
    "/api/user/profile",
    upload.single("profilePhoto"),
    async (req, res) => {},
  );

  // Admin endpoints for bar verification
  app.put("/api/admin/bars/:id/verify", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    const barId = Number(req.params.id);

    try {
      const [bar] = await db
        .update(kavaBars)
        .set({
          verificationStatus: "verified_kava_bar",
          lastVerified: new Date(),
        })
        .where(eq(kavaBars.id, barId))
        .returning();

      if (!bar) {
        return res.status(404).send("Bar not found");
      }

      res.json(bar);
    } catch (error: any) {
      console.error("Error verifying bar:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/update-coords/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      console.log("\n\nRequest received\n\n");
      const { id } = req.params;
      console.log("Body : ", req.body);
      const { lat, lng } = req.body;

      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);

      if (isNaN(latNum) || isNaN(lngNum)) {
        return res.status(400).json({ error: "Invalid coordinates" });
      }

      await db
        .update(kavaBars)
        .set({
          location: { lat: latNum, lng: lngNum },
        })
        .where(eq(kavaBars.id, parseInt(id)));

      res.status(200).json({ success: true, lat: latNum, lng: lngNum });
    } catch (error: any) {
      console.error("BAR COORD UPDATE ERROR", error.message);
      res.status(500).json({
        error: "Failed to update coordinates",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  app.post("/api/admin/verification-requests/:id/deny", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const requestId = Number(req.params.id);
      if (isNaN(requestId)) {
        return res.status(400).json({ error: "Invalid request ID" });
      }

      // Update the verification request status
      const [updatedRequest] = await db
        .update(verificationRequests)
        .set({
          status: "denied",
          updatedAt: new Date(),
        })
        .where(eq(verificationRequests.id, requestId))
        .returning();

      if (!updatedRequest) {
        return res
          .status(404)
          .json({ error: "Verification request not found" });
      }

      res.json({
        success: true,
        message: "Verification request denied successfully",
      });
    } catch (error: any) {
      console.error("Error denying verification request:", error);
      res.status(500).json({
        error: "Failed to deny verification request",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  // Add this new endpoint after the existing admin endpoints
  app.post("/api/admin/fetch-california-bars", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      const result = await fetchCaliforniaKavaBars();
      res.json({
        message: "Successfully fetched California kava bar data",
        stats: result,
      });
    } catch (error: any) {
      console.error("Error fetching California kava bar data:", error);
      res.status(500).json({ error: error.message });
    }
  });
  // Add this new endpoint after the existing verification endpoints
  app.post("/api/admin/fetch-western-bars", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin accessrequired");
    }

    try {
      console.log("Starting western states kava bars search...");
      const results = await fetchWesternKavaBars();
      res.json({
        message: "Successfully fetched western states kava bar data",
        results,
      });
    } catch (error: any) {
      console.error("Error fetching western states kava bar data:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add this new endpoint after the existing admin endpoints
  app.post("/api/admin/fetch-state-bars/:state", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    const { state } = req.params;
    const validStates = ["Tennessee", "Nevada", "New Mexico", "Utah"];
    if (!validStates.includes(state)) {
      return res.status(400).json({
        error: "Invalid state",
        validStates,
      });
    }

    try {
      console.log(`Starting ${state} kava bars search...`);
      const results = await fetchStateData(state);

      // Add a delay to ensure database changes are reflected
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get updated bar count for the state
      const stateBarCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM kava_bars
        WHERE deleted_at IS NULL AND address ILIKE ${`%${state}%`}
      `);

      res.json({
        message: `Successfully fetched ${state} kava bar data`,
        results,
        barCount: stateBarCount.rows[0].count,
      });
    } catch (error: any) {
      console.error(`Error fetching ${state} kava bar data:`, error);
      res.status(500).json({ error: error.message });
    }
  });
  //  // Add this endpoint after the existing admin endpoints
  app.post("/api/admin/restore-states", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      // Start the restoration process
      console.log("Starting state data restoration process...");
      const results = await restoreAllStates();

      res.json({
        message: "State restoration process completed",
        results,
      });
    } catch (error: any) {
      console.error("Error during state restoration:", error);
      res.status(500).json({
        error: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });
  app.post("/api/admin/restore-target-states", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    const targetStates = ["Tennessee", "Nevada", "New Mexico", "Utah"];

    try {
      console.log("Starting targeted state restoration process...");
      const results = await restoreAllStates(true, targetStates);

      res.json({
        message: "Targeted state restoration completed",
        results,
      });
    } catch (error: any) {
      console.error("Error during targeted state restoration:", error);
      res.status(500).json({
        error: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });

  app.post("/api/admin/restore-all-states", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      console.log("Starting complete state restoration process...");

      // Import the restore function that handles all states
      const results = await restoreAllStates();

      // Get current state distribution after restoration
      const stateDistribution = await db.execute(sql`
        SELECT
          CASE
            WHEN address ILIKE '%florida%' OR address ILIKE '%, fl%' THEN 'Florida'
            WHEN address ILIKE '%texas%' OR address ILIKE '%, tx%' THEN 'Texas'
            WHEN address ILIKE '%arizona%' OR address ILIKE '%, az%' THEN 'Arizona'
            WHEN address ILIKE '%arkansas%' OR address ILIKE '%, ar%' THEN 'Arkansas'
            WHEN address ILIKE '%georgia%' OR address ILIKE '%, ga%' THEN 'Georgia'
            WHEN address ILIKE '%louisiana%' OR address ILIKE '%, la%' THEN 'Louisiana'
            WHEN address ILIKE '%mississippi%' OR address ILIKE '%, ms%' THEN 'Mississippi'
            WHEN address ILIKE '%north carolina%' OR address ILIKE '%, nc%' THEN 'North Carolina'
            WHEN address ILIKE '%south carolina%' OR address ILIKE '%, sc%' THEN 'South Carolina'
            WHEN address ILIKE '%virginia%' OR address ILIKE '%, va%' THEN 'Virginia'
            WHEN address ILIKE '%tennessee%' OR address ILIKE '%, tn%' THEN 'Tennessee'
            WHEN address ILIKE '%nevada%' OR address ILIKE '%, nv%' THEN 'Nevada'
            WHEN address ILIKE '%new mexico%' OR address ILIKE '%, nm%' THEN 'New Mexico'
            WHEN address ILIKE '%utah%' OR address ILIKE '%, ut%' THEN 'Utah'
            WHEN address ILIKE '%oklahoma%' OR address ILIKE '%, ok%' THEN 'Oklahoma'
            WHEN address ILIKE '%alabama%' OR address ILIKE '%, al%' THEN 'Alabama'
            ELSE 'Other'
          END as state,
          COUNT(*) as bar_count,
          COUNT(CASE WHEN verification_status = 'verified_kava_bar' THEN 1 END) as verified_count
        FROM kava_bars
        WHERE deleted_at IS NULL
        GROUP BY state
        ORDER BY bar_count DESC
      `);

      res.json({
        message: "State restoration process completed",
        results,
        currentDistribution: stateDistribution.rows,
      });
    } catch (error: any) {
      console.error("Error during state restoration:", error);
      res.status(500).json({
        error: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });
}

function addDays(date: Date, days: number): Date {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}

interface InsertReview {
  userId: number;
  barId: number;
  rating: number;
  content: string;
}

async function verifyKavaBarType(
  placeId: string,
): Promise<{ success: boolean; isKavaBar: boolean | null }> {
  try {
    const response = await googleMapsClient.placeDetails({
      params: {
        place_id: placeId,
        fields: ["name", "types", "business_status"],
        key: process.env.GOOGLE_MAPS_API_KEY || "",
      },
    });

    const placeDetails = response.data.result;
    const types = placeDetails.types || [];
    const isKavaBar = types.some(
      (type) =>
        type.toLowerCase().includes("bar") ||
        type.toLowerCase().includes("cafe") ||
        type.toLowerCase().includes("night_club"),
    );

    return {
      success: true,
      isKavaBar,
    };
  } catch (error) {
    console.error("Error verifying kava bar type:", error);
    return { success: false, isKavaBar: null };
  }
}

// Placeholder for the actual startDataCollection function.  This needs to be implemented separately.
async function startDataCollection(): Promise<{ message: string }> {
  // Implement your background data collection logic here.  This might involve
  // using a queue or worker process to handle the task asynchronously.
  // Example:
  console.log("Starting data collection...");
  // ...your code to collect data...
  console.log("Data collection finished.");
  return { message: "Data collection finished." };
}

// Added function to get collection status.  Replace with actual implementation.
async function getCollectionStatus(): Promise<string> {
  // Replace with your actual implementation to get the status.
  return "complete";
}

//This function needs to be implemented.
async function restoreAllStates(
  overwriteProgress: boolean = false,
  targetStates?: string[],
): Promise<any[]> {
  //Implementation to restore all states will go here.  This function should handle the actual restoration process, likely involving reading from a backup or other source and updating the database.
  console.log("Restoring all states...");
  const STATES = [
    "Tennessee",
    "Nevada",
    "New Mexico",
    "Utah",
    "Florida",
    "Georgia",
    "South Carolina",
    "North Carolina",
    "Virginia",
    "Alabama",
    "Mississippi",
    "Louisiana",
    "Arkansas",
    "Oklahoma",
    "Texas",
    "Arizona",
  ];
  const results = [];
  for (const state of targetStates || STATES) {
    try {
      const restoreResult = await restoreStateData(state, overwriteProgress);
      results.push({ state, ...restoreResult });
    } catch (error) {
      results.push({ state, error: error.message });
    }
  }
  return results;
}

async function fetchWesternKavaBars(): Promise<any[]> {
  //Implementation to fetch western bars will go here.  This will likely involve querying a database or external API.  The result should be an array of kava bar objects.
  console.log("Fetching western bars...");
  // Add your fetching logic here.
  return [];
}

async function restoreStateData(
  state: string,
  overwriteProgress: boolean,
): Promise<{ restored: number; failed: number; skipped: number }> {
  console.log(`Restoring state data for ${state}...`);
  // Add your restoration logic here for the specific state.  This might involve
  // reading from a backup file or database for that state and updating the database.
  // For example, you might read data from a file named `${state}.json`
  // and then update the kavaBars table with data specific to that state.
  // Update the progress file only if overwriteProgress is true.
  const restored = 10;
  const failed = 2;
  const skipped = 0;
  return { restored, failed, skipped };
}

async function fetchStateData(state: string): Promise<any[]> {
  return [];
}

async function sendVerificationCode(phoneNumber: string): Promise<boolean> {
  // Add your verification code sending logic here.  This will likely involve
  // using a third-party SMS API or other communication method.
  console.log(`Sending verification code to ${phoneNumber}...`);
  // Your code to send verification code
  return true;
}

function formatToE164(phoneNumber: string): string {
  // Add your phone number formatting logic here.  This function should take a
  // phone number in any format and convert it to E.164 format (+15551234567).
  return phoneNumber;
}
