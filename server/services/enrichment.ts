import prisma from "../utils/prisma";
import { enqueueJob } from "../queue/queue";
import { extractFoundersWithGemini } from "./gemini";
import { updateProgress, PROGRESS_STEPS } from "./progress";



/**
 * ENRICHMENT LAYER - Smart Extraction
 * 
 * Strategy: Gemini AI FIRST, patterns as fallback
 * 
 * Why Gemini first?
 * - Much more accurate at finding founder names from context
 * - Can understand the website content semantically
 * - Free tier is generous (1500 requests/day)
 * - Patterns only catch explicit mentions like "Founder: John"
 */

interface FounderInfo {
  name: string;
  role: string;
  confidence: "high" | "medium" | "low";
  source: "pattern" | "ai" | "gemini";
}

interface EnrichmentResult {
  founders: FounderInfo[];
  usedAI: boolean;
  pattern_matches: number;
}

/**
 * PATTERN-BASED FOUNDER EXTRACTION (Fallback)
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
  // Owner mentions
  {
    pattern: /owner[s]?\s*[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    role: "Owner",
    confidence: "medium" as const,
  },
  // President
  {
    pattern: /president\s*[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    role: "President",
    confidence: "medium" as const,
  },
];

/**
 * Extract founders using PATTERN MATCHING (fallback)
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
 * MAIN ENRICHMENT PIPELINE
 * Gemini AI first → Patterns as fallback
 */
export const enrichFounderData = async (
  storeId: string,
  textContent: string
): Promise<EnrichmentResult> => {
  try {
    console.log(`[v0] ENRICHMENT: Starting for store ${storeId}`);

    // Get the store URL for Gemini context
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { url: true },
    });
    const storeUrl = store?.url || '';

    // STEP 1: Try Gemini AI first (much more accurate)
    await updateProgress(storeId, PROGRESS_STEPS.ANALYZING_WITH_AI);
    const geminiFounders = await extractFoundersWithGemini(storeUrl, textContent);
    console.log(
      `[v0] ENRICHMENT: Gemini found ${geminiFounders.length} founders`
    );

    // STEP 2: Use patterns as fallback if Gemini found nothing
    let allFounders: FounderInfo[] = [...geminiFounders];
    let usedAI = geminiFounders.length > 0;

    if (allFounders.length === 0) {
      console.log(
        `[v0] ENRICHMENT: Gemini found nothing, trying patterns...`
      );
      const patternFounders = extractFoundersWithPatterns(textContent);
      allFounders = patternFounders;
      console.log(
        `[v0] ENRICHMENT: Patterns found ${patternFounders.length} founders`
      );
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
        action: "enriched",
        details: JSON.stringify({
          foundersCount: allFounders.length,
          geminiMatches: geminiFounders.length,
          patternMatches: allFounders.filter(f => f.source === "pattern").length,
          usedAI,
          sources: {
            gemini: allFounders.filter((f) => f.source === "gemini").length,
            pattern: allFounders.filter((f) => f.source === "pattern").length,
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
      `[v0] ENRICHMENT: Completed. Found ${allFounders.length} founders (${usedAI ? "Gemini AI" : "patterns only"})`
    );

    return {
      founders: allFounders,
      usedAI,
      pattern_matches: allFounders.filter(f => f.source === "pattern").length,
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
