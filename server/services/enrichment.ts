import prisma from "../utils/prisma";
import { enqueueJob } from "../queue/queue";



/**
 * ENRICHMENT LAYER - Smart Extraction
 * 
 * RULE: Patterns FIRST, AI ONLY if patterns fail
 * 
 * Why?
 * - Patterns are fast, cheap, consistent, deterministic
 * - AI is slow, expensive, variable
 * - Most sites have explicit founder info
 */

interface FounderInfo {
  name: string;
  role: string;
  confidence: "high" | "medium" | "low";
  source: "pattern" | "ai";
}

interface EnrichmentResult {
  founders: FounderInfo[];
  usedAI: boolean;
  pattern_matches: number;
}

/**
 * PATTERN-BASED FOUNDER EXTRACTION
 * Deterministic - NO external APIs needed
 */
const FOUNDER_PATTERNS = [
  // EXPLICIT mentions (highest confidence)
  {
    pattern: /founded\s+(?:by|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    role: "Founder",
    confidence: "high" as const,
  },
  {
    pattern: /founder[s]?\s*[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    role: "Founder",
    confidence: "high" as const,
  },
  {
    pattern: /co-founder[s]?\s*[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    role: "Co-Founder",
    confidence: "high" as const,
  },
  // LEADERSHIP (medium confidence)
  {
    pattern: /ceo\s*[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    role: "CEO",
    confidence: "medium" as const,
  },
  {
    pattern: /cto\s*[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    role: "CTO",
    confidence: "medium" as const,
  },
];

/**
 * STEP 1: Extract founders using PATTERN MATCHING
 * Fast (milliseconds), cheap (free), reliable
 */
export const extractFoundersWithPatterns = (
  textContent: string
): FounderInfo[] => {
  const founders: FounderInfo[] = [];
  const seenNames = new Set<string>();

  for (const { pattern, role, confidence } of FOUNDER_PATTERNS) {
    let match;

    while ((match = pattern.exec(textContent)) !== null) {
      const name = match[1]?.trim();

      if (
        name &&
        !seenNames.has(name) &&
        name.length >= 3 &&
        name.length <= 50 &&
        !name.includes("@") // Not an email
      ) {
        seenNames.add(name);
        founders.push({
          name,
          role,
          confidence,
          source: "pattern",
        });
      }
    }
  }

  return founders;
};

/**
 * STEP 2: AI Enrichment - FALLBACK ONLY
 * Only called if patterns fail
 */
const enrichWithAI = async (
  textContent: string
): Promise<FounderInfo[]> => {
  if (!process.env.OPENAI_API_KEY) {
    console.log(`[v0] ENRICHMENT: No OpenAI key, patterns only`);
    return [];
  }

  try {
    console.log(`[v0] ENRICHMENT: Attempting AI enrichment...`);

    const { OpenAI } = await import("openai");
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Only send relevant excerpt (save tokens)
    const excerpt = textContent.substring(0, 2000);

    const message = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Extract founder/leadership names from text. Return JSON: [{"name": "...", "role": "..."}]. Be strict - only names you're certain about. Return [] if unclear.`,
        },
        {
          role: "user",
          content: excerpt,
        },
      ],
      temperature: 0.1, // Low temp = consistent
      max_tokens: 200,
    });

    let aiFounders: FounderInfo[] = [];

    try {
      const content = message.content[0];
      if (content.type === "text") {
        const jsonMatch = content.text.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          aiFounders = parsed
            .filter((f: any) => f.name && f.role)
            .map((f: any) => ({
              name: f.name,
              role: f.role,
              confidence: "medium" as const,
              source: "ai" as const,
            }));
        }
      }
    } catch (parseError) {
      console.warn(`[v0] ENRICHMENT: AI parse failed`, parseError);
    }

    console.log(`[v0] ENRICHMENT: AI found ${aiFounders.length} founders`);
    return aiFounders;
  } catch (error) {
    console.warn(`[v0] ENRICHMENT: AI failed, continuing with patterns`, error);
    return [];
  }
};

/**
 * MAIN ENRICHMENT PIPELINE
 * Patterns first → AI only if needed
 */
export const enrichFounderData = async (
  storeId: string,
  textContent: string
): Promise<EnrichmentResult> => {
  try {
    console.log(`[v0] ENRICHMENT: Starting for store ${storeId}`);

    // STEP 1: Try patterns (fast, free)
    const patternFounders = extractFoundersWithPatterns(textContent);
    console.log(
      `[v0] ENRICHMENT: Patterns found ${patternFounders.length} founders`
    );

    // STEP 2: Use AI only if patterns found nothing or only low-confidence results
    let allFounders = patternFounders;
    let usedAI = false;

    const highConfidence = patternFounders.filter((f) => f.confidence === "high");
    if (highConfidence.length === 0) {
      console.log(
        `[v0] ENRICHMENT: No high-confidence pattern matches, trying AI...`
      );
      const aiFounders = await enrichWithAI(textContent);
      allFounders = [...patternFounders, ...aiFounders];
      usedAI = aiFounders.length > 0;
    }

    // STEP 3: Save to database
    for (const founder of allFounders) {
      // Check if founder already exists
      const existing = await prisma.founder.findFirst({
        where: { storeId, name: founder.name },
      });
      if (!existing) {
        await prisma.founder.create({
          data: {
            storeId,
            name: founder.name,
            role: founder.role,
          },
        });
      }
    }

    // STEP 4: Update store
    await prisma.store.update({
      where: { id: storeId },
      data: { enrichedAt: new Date() },
    });

    // STEP 5: Log to history with detailed info
    await prisma.storeHistory.create({
      data: {
        storeId,
        action: "enriched", // Event type
        details: JSON.stringify({
          foundersCount: allFounders.length,
          patternMatches: patternFounders.length,
          aiMatches: allFounders.length - patternFounders.length,
          usedAI,
          sources: {
            pattern: allFounders.filter((f) => f.source === "pattern").length,
            ai: allFounders.filter((f) => f.source === "ai").length,
          },
        }),
      },
    });

    // STEP 6: Enqueue next jobs
    for (const founder of allFounders) {
      await enqueueJob("search-linkedin", {
        storeId,
        founderName: founder.name,
        founderRole: founder.role,
      });
    }
    await enqueueJob("score-lead", { storeId });

    console.log(
      `[v0] ENRICHMENT: Completed. Found ${allFounders.length} founders (${usedAI ? "with AI" : "patterns only"})`
    );

    return {
      founders: allFounders,
      usedAI,
      pattern_matches: patternFounders.length,
    };
  } catch (error) {
    console.error(`[v0] ENRICHMENT ERROR for ${storeId}:`, error);

    await prisma.storeHistory.create({
      data: {
        storeId,
        action: "enriched_error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    throw error;
  }
};

/**
 * Rule-based business type classification
 * NO AI - just keyword matching
 */
export const classifyBusinessType = (text: string): string => {
  const lower = text.toLowerCase();
  const scores: { [key: string]: number } = {};

  // SaaS signals
  if (lower.includes("saas")) scores["SaaS"] = (scores["SaaS"] || 0) + 3;
  if (lower.includes("software")) scores["SaaS"] = (scores["SaaS"] || 0) + 2;
  if (lower.includes("cloud")) scores["SaaS"] = (scores["SaaS"] || 0) + 1;

  // E-commerce signals
  if (lower.includes("ecommerce")) scores["E-commerce"] = (scores["E-commerce"] || 0) + 3;
  if (lower.includes("shop")) scores["E-commerce"] = (scores["E-commerce"] || 0) + 2;
  if (lower.includes("products")) scores["E-commerce"] = (scores["E-commerce"] || 0) + 1;

  // Agency signals
  if (lower.includes("agency")) scores["Agency"] = (scores["Agency"] || 0) + 3;
  if (lower.includes("services")) scores["Agency"] = (scores["Agency"] || 0) + 1;

  // Creator signals
  if (lower.includes("content")) scores["Content"] = (scores["Content"] || 0) + 2;
  if (lower.includes("creator")) scores["Content"] = (scores["Content"] || 0) + 3;

  const [type] = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return type ? type[0] : "Other";
};
