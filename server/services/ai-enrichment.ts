import OpenAI from "openai";
import { Client, PlaceDetailsResponse } from "@googlemaps/google-maps-services-js";
import { db } from "../../db";
import { kavaBars } from "../../db/schema";
import { eq } from "drizzle-orm";

// Lazy-initialized clients
let openaiClient: OpenAI | null = null;
let mapsClient: Client | null = null;

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set. Please add your OpenAI API key to use this feature.");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function getMapsClient(): Client {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY is not set. Please add your Google Maps API key to use this feature.");
  }
  if (!mapsClient) {
    mapsClient = new Client({});
  }
  return mapsClient;
}

interface MenuHighlight {
  name: string;
  price: number | null;
  description: string;
}

interface EnrichmentResult {
  vibeText: string;
  menuHighlights: MenuHighlight[];
  features: string[];
}

interface GooglePlaceData {
  editorialSummary: string | null;
  reviews: string[];
  priceLevel: number | null;
}

async function fetchGooglePlaceData(placeId: string): Promise<GooglePlaceData> {
  const client = getMapsClient();
  
  const response: PlaceDetailsResponse = await client.placeDetails({
    params: {
      place_id: placeId,
      fields: ["editorial_summary", "reviews", "price_level"],
      key: process.env.GOOGLE_MAPS_API_KEY!,
    },
  });

  const result = response.data.result;
  
  // Extract editorial summary
  const editorialSummary = (result as any).editorial_summary?.overview || null;
  
  // Extract top 5 reviews (sorted by relevance by Google)
  const reviews: string[] = [];
  if (result.reviews && Array.isArray(result.reviews)) {
    const topReviews = result.reviews.slice(0, 5);
    for (const review of topReviews) {
      if (review.text) {
        reviews.push(review.text);
      }
    }
  }
  
  // Extract price level (0-4 scale)
  const priceLevel = result.price_level ?? null;
  
  return {
    editorialSummary,
    reviews,
    priceLevel,
  };
}

export async function enrichBarData(barId: number): Promise<EnrichmentResult> {
  // Step 1: Get bar from database
  const [bar] = await db
    .select()
    .from(kavaBars)
    .where(eq(kavaBars.id, barId))
    .limit(1);

  if (!bar) {
    throw new Error(`Bar with ID ${barId} not found`);
  }

  // Step 2: Validate place_id exists
  if (!bar.placeId) {
    throw new Error(`Bar "${bar.name}" (ID: ${barId}) does not have a place_id. Cannot fetch Google data.`);
  }

  // Step 3: Fetch real data from Google Places API
  let googleData: GooglePlaceData;
  try {
    googleData = await fetchGooglePlaceData(bar.placeId);
  } catch (error: any) {
    console.error(`Failed to fetch Google data for ${bar.name}:`, error.message);
    // Fall back to basic enrichment without Google data
    googleData = {
      editorialSummary: null,
      reviews: [],
      priceLevel: null,
    };
  }

  // Step 4: Build rich prompt with real Google data
  const reviewsText = googleData.reviews.length > 0
    ? googleData.reviews.map((r, i) => `Review ${i + 1}: "${r}"`).join("\n\n")
    : "No customer reviews available.";

  const editorialText = googleData.editorialSummary
    ? `Google Editorial Summary: "${googleData.editorialSummary}"`
    : "No editorial summary available.";

  const priceLevelText = googleData.priceLevel !== null
    ? `Price Level: ${googleData.priceLevel}/4 (${"$".repeat(googleData.priceLevel + 1)})`
    : "Price level not available.";

  const prompt = `You are an expert at describing kava bars. Based on the following REAL bar information and customer reviews, generate authentic content:

1. A "vibe_text" - a 3-sentence atmospheric description of what it's like to visit this kava bar. Use the real reviews and editorial summary to capture the authentic vibe. Make it inviting and true to the actual customer experience.

2. "menu_highlights" - an array of 3-5 menu items. If reviews mention specific drinks or items, include those. Otherwise, suggest typical kava bar offerings with estimated prices.

3. "features" - an array of 5-8 amenity tags based on what customers mention in reviews (e.g., "WiFi", "Pool Table", "Live Music", "Outdoor Seating", "Late Night", "Friendly Staff", etc.)

=== BAR INFORMATION ===
- Name: ${bar.name}
- Address: ${bar.address}
- Phone: ${bar.phone || "Not available"}
- Current Rating: ${bar.rating}
- ${priceLevelText}

=== GOOGLE DATA ===
${editorialText}

=== CUSTOMER REVIEWS ===
${reviewsText}

Respond with JSON in this exact format:
{
  "vibe_text": "Three sentence description here based on real customer experiences...",
  "menu_highlights": [
    {"name": "Shell of Kava", "price": 8, "description": "Traditional kava served in a coconut shell"},
    {"name": "Kava Flight", "price": 15, "description": "Sample three different kava varieties"}
  ],
  "features": ["WiFi", "Pool Table", "Board Games", "Late Night Hours", "Outdoor Patio"]
}`;

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert at describing kava bars and their atmosphere. Use the real customer reviews and Google data provided to create authentic, accurate descriptions. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const result = JSON.parse(content);

    const enrichmentResult: EnrichmentResult = {
      vibeText: result.vibe_text || "",
      menuHighlights: result.menu_highlights || [],
      features: result.features || [],
    };

    // Step 5: Save to database
    await db
      .update(kavaBars)
      .set({
        vibeText: enrichmentResult.vibeText,
        menuHighlights: enrichmentResult.menuHighlights,
        features: enrichmentResult.features,
      })
      .where(eq(kavaBars.id, barId));

    return enrichmentResult;
  } catch (error: any) {
    console.error("Error enriching bar data:", error);
    throw new Error(`Failed to enrich bar data: ${error.message}`);
  }
}
