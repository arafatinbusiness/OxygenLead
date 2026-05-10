import prisma from "../utils/prisma";
import axios from "axios";



export const searchLinkedinProfiles = async (
  storeId: string,
  founderName: string,
  founderRole?: string
) => {
  try {
    console.log(
      `[v0] Searching LinkedIn for ${founderName} from store ${storeId}`
    );

    // This is a placeholder - in production, you'd integrate with LinkedIn's official API
    // or use a third-party service like Apollo.io or RocketReach

    // For now, we'll create placeholder matches based on the founder info
    const matches = generatePlaceholderMatches(founderName, founderRole);

    // Save matches to database
    for (const match of matches) {
      await prisma.linkedinMatch.upsert({
        where: {
          storeId_linkedinUrl: {
            storeId,
            linkedinUrl: match.linkedinUrl,
          },
        },
        update: {},
        create: {
          storeId,
          name: match.name,
          title: match.title,
          company: match.company,
          linkedinUrl: match.linkedinUrl,
          matchConfidence: match.matchConfidence,
        },
      });
    }

    console.log(
      `[v0] Found ${matches.length} LinkedIn matches for ${founderName}`
    );
    return matches;
  } catch (error) {
    console.error(
      `[v0] LinkedIn search error for ${founderName}:`,
      error
    );
    throw error;
  }
};

function generatePlaceholderMatches(
  founderName: string,
  role?: string
): Array<{
  name: string;
  title?: string;
  company?: string;
  linkedinUrl: string;
  matchConfidence: number;
}> {
  // In production, replace with actual API calls
  return [
    {
      name: founderName,
      title: role || "Founder",
      company: "Unknown",
      linkedinUrl: `https://linkedin.com/in/${founderName.toLowerCase().replace(/\s+/g, "-")}`,
      matchConfidence: 0.75,
    },
  ];
}

// Helper to validate LinkedIn URL
export const isValidLinkedInUrl = (url: string): boolean => {
  return /linkedin\.com\/in\/|linkedin\.com\/company\//.test(url);
};

// Helper to extract LinkedIn profile ID from URL
export const extractLinkedInId = (url: string): string | null => {
  const match = url.match(/\/(?:in|company)\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
};
