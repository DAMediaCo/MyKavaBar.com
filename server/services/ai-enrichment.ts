import OpenAI from "openai";
import { db } from "../../db";
import { kavaBars } from "../../db/schema";
import { eq } from "drizzle-orm";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set. Please add your OpenAI API key to use this feature.");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
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

export async function enrichBarData(barId: number): Promise<EnrichmentResult> {
  const [bar] = await db
    .select()
    .from(kavaBars)
    .where(eq(kavaBars.id, barId))
    .limit(1);

  if (!bar) {
    throw new Error(`Bar with ID ${barId} not found`);
  }

  const prompt = `You are an expert at describing kava bars. Based on the following bar information, generate:

1. A "vibe_text" - a 3-sentence atmospheric description of what it's like to visit this kava bar. Make it inviting and authentic to kava bar culture.

2. "menu_highlights" - an array of 3-5 popular menu items that a typical kava bar like this would serve. Include name, estimated price (as a number), and a brief description.

3. "features" - an array of 5-8 amenity tags that this type of establishment would likely have (e.g., "WiFi", "Pool Table", "Live Music", "Outdoor Seating", "Late Night", etc.)

Bar Information:
- Name: ${bar.name}
- Address: ${bar.address}
- Phone: ${bar.phone || "Not available"}
- Current Rating: ${bar.rating}
- Verification Status: ${bar.verificationStatus || "pending"}
- Business Status: ${bar.businessStatus || "OPERATIONAL"}

Respond with JSON in this exact format:
{
  "vibe_text": "Three sentence description here...",
  "menu_highlights": [
    {"name": "Shell of Kava", "price": 8, "description": "Traditional kava served in a coconut shell"},
    {"name": "Kava Flight", "price": 15, "description": "Sample three different kava varieties"}
  ],
  "features": ["WiFi", "Pool Table", "Board Games", "Late Night Hours", "Outdoor Patio"]
}`;

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert at describing kava bars and their atmosphere. Always respond with valid JSON.",
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
