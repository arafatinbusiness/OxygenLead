import prisma from "../utils/prisma";



interface ScoringFactors {
  founderVisibility: number; // 0-25 points
  brandingQuality: number; // 0-20 points
  businessMaturity: number; // 0-20 points
  socialActivity: number; // 0-15 points
  customDomain: number; // 0-10 points
  linkedinPresence: number; // 0-10 points
}

export const calculateLeadScore = async (storeId: string): Promise<number> => {
  try {
    console.log(`[v0] Calculating lead score for store ${storeId}`);

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: {
        founders: true,
        socialAccounts: true,
        linkedinMatches: true,
        jobListings: true,
      },
    });

    if (!store) {
      throw new Error("Store not found");
    }

    const factors = scoreFactors(store);
    const totalScore = Math.min(
      100,
      factors.founderVisibility +
        factors.brandingQuality +
        factors.businessMaturity +
        factors.socialActivity +
        factors.customDomain +
        factors.linkedinPresence
    );

    // Save score
    await prisma.store.update({
      where: { id: storeId },
      data: {
        leadScore: Math.round(totalScore),
        leadScoreCalculatedAt: new Date(),
      },
    });

    // Add to history
    await prisma.storeHistory.create({
      data: {
        storeId,
        action: "score_calculated",
        details: JSON.stringify({
          score: Math.round(totalScore),
          factors,
        }),
      },
    });

    console.log(
      `[v0] Store ${storeId} lead score: ${Math.round(totalScore)}`
    );
    return totalScore;
  } catch (error) {
    console.error(`[v0] Scoring error for ${storeId}:`, error);

    await prisma.storeHistory.create({
      data: {
        storeId,
        action: "scoring_error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    throw error;
  }
};

function scoreFactors(store: any): ScoringFactors {
  const factors: ScoringFactors = {
    founderVisibility: 0,
    brandingQuality: 0,
    businessMaturity: 0,
    socialActivity: 0,
    customDomain: 0,
    linkedinPresence: 0,
  };

  // Founder visibility (0-25 points)
  // Points for number of founders and their bios
  if (store.founders && store.founders.length > 0) {
    const founderCount = Math.min(store.founders.length, 5);
    factors.founderVisibility += founderCount * 5;

    // Bonus points for bios
    const foundersWithBios = store.founders.filter((f) => f.bio).length;
    factors.founderVisibility += Math.min(foundersWithBios * 5, 10);
  }

  // Branding quality (0-20 points)
  if (store.storeName) {
    factors.brandingQuality += 10;
  }

  // Business maturity (0-20 points)
  // Points for job listings (sign of growth)
  if (store.jobListings && store.jobListings.length > 0) {
    factors.businessMaturity += Math.min(store.jobListings.length * 4, 15);
  }

  // LinkedIn matches indicate established team
  if (store.linkedinMatches && store.linkedinMatches.length > 0) {
    factors.businessMaturity += Math.min(5, store.linkedinMatches.length * 2);
  }

  // Social activity (0-15 points)
  if (store.socialAccounts && store.socialAccounts.length > 0) {
    factors.socialActivity += Math.min(store.socialAccounts.length * 3, 15);
  }

  // Custom domain (0-10 points)
  if (store.domain && !store.domain.includes("shopify")) {
    factors.customDomain = 10;
  }

  // LinkedIn presence (0-10 points)
  const linkedinProfile = store.socialAccounts?.find(
    (s) => s.platform === "linkedin"
  );
  if (linkedinProfile) {
    factors.linkedinPresence = 10;
  }

  return factors;
}

// Helper to get score interpretation
export const scoreInterpretation = (
  score: number
): {
  level: string;
  description: string;
  color: string;
} => {
  if (score >= 80) {
    return {
      level: "Hot",
      description: "High-quality lead with strong indicators",
      color: "red",
    };
  }
  if (score >= 60) {
    return {
      level: "Warm",
      description: "Good potential with several positive signals",
      color: "orange",
    };
  }
  if (score >= 40) {
    return {
      level: "Lukewarm",
      description: "Some positive indicators but needs more research",
      color: "yellow",
    };
  }
  return {
    level: "Cold",
    description: "Limited information or negative signals",
    color: "gray",
  };
};
