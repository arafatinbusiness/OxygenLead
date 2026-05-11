/**
 * Gemini AI Service
 * 
 * Uses Google's Gemini API to extract founder/owner/CEO information
 * from website content. Free tier: 60 requests/min, 1500 requests/day.
 * 
 * Strategy: Call Gemini with just the URL first (fast, 1-2 seconds).
 * Gemini knows about most companies from its training data.
 * Only fall back to scraped content if URL-only fails.
 */

interface GeminiFounderResult {
  name: string;
  role: string;
  confidence: "high" | "medium" | "low";
  source: "gemini";
}

/**
 * Quick founder lookup using ONLY the URL (no scraping needed).
 * Gemini uses its training data to identify the founder.
 * Takes 1-2 seconds.
 */
export const quickFounderLookup = async (
  url: string
): Promise<GeminiFounderResult[]> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log(`[v0] GEMINI: No API key configured, skipping`);
    return [];
  }

  try {
    const domain = url.replace(/https?:\/\//, '').replace(/\/.*$/, '').replace('www.', '');
    console.log(`[v0] GEMINI: Quick lookup for ${domain}...`);

    const prompt = `You are a business research assistant. I need to find the founder, owner, or CEO of a company.

Company website: ${url}
Domain: ${domain}

Based on your knowledge, who is the founder, owner, or CEO of this company?

Return ONLY a valid JSON array (no markdown, no code blocks, no extra text):
[
  {
    "name": "Full Name",
    "role": "Founder/CEO/Owner/etc",
    "confidence": "high/medium/low"
  }
]

Rules:
- If you know the founder/owner/CEO, return their name with high confidence
- If you're somewhat sure, use medium confidence
- If you're guessing, use low confidence
- If you don't know, return an empty array []
- The name should be a real person's name, not a company name
- Only return people who are actually associated with this specific company`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[v0] GEMINI: API error ${response.status}: ${errorText}`);
      return [];
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      console.log(`[v0] GEMINI: Empty response`);
      return [];
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Find the first [ or { to start parsing
    const arrayStart = jsonStr.indexOf('[');
    if (arrayStart === -1) {
      console.log(`[v0] GEMINI: No JSON array found in response: ${text.substring(0, 200)}`);
      return [];
    }
    jsonStr = jsonStr.substring(arrayStart);

    const arrayEnd = jsonStr.lastIndexOf(']');
    if (arrayEnd === -1) {
      console.log(`[v0] GEMINI: No closing bracket found`);
      return [];
    }
    jsonStr = jsonStr.substring(0, arrayEnd + 1);

    const parsed = JSON.parse(jsonStr);
    
    if (!Array.isArray(parsed)) {
      console.log(`[v0] GEMINI: Response is not an array`);
      return [];
    }

    const founders: GeminiFounderResult[] = parsed
      .filter((f: any) => f.name && typeof f.name === 'string' && f.name.length >= 3)
      .map((f: any) => ({
        name: f.name.trim(),
        role: f.role || 'Founder',
        confidence: ['high', 'medium', 'low'].includes(f.confidence) ? f.confidence : 'medium',
        source: 'gemini' as const,
      }));

    console.log(`[v0] GEMINI: Quick lookup found ${founders.length} founder(s) for ${domain}:`, 
      founders.map(f => `${f.name} (${f.role})`).join(', '));

    return founders;
  } catch (error) {
    console.error(`[v0] GEMINI: Error in quick lookup for ${url}:`, error);
    return [];
  }
};

/**
 * Extract founder information using Google's Gemini API with scraped content.
 * Used as fallback when quick URL lookup fails.
 */
export const extractFoundersWithGemini = async (
  url: string,
  textContent: string
): Promise<GeminiFounderResult[]> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log(`[v0] GEMINI: No API key configured, skipping`);
    return [];
  }

  try {
    console.log(`[v0] GEMINI: Analyzing ${url} with scraped content...`);

    // Prepare the content - limit to avoid token issues
    const excerpt = textContent.substring(0, 3000);
    const domain = url.replace(/https?:\/\//, '').replace(/\/.*$/, '').replace('www.', '');

    const prompt = `You are analyzing a business website to find the founder, owner, or CEO.

Website URL: ${url}
Domain: ${domain}

Here is the scraped content from the website:
---
${excerpt}
---

Based on the URL and content above, identify the founder, owner, or CEO of this business.

Return ONLY a valid JSON array (no markdown, no code blocks, no extra text):
[
  {
    "name": "Full Name",
    "role": "Founder/CEO/Owner/etc",
    "confidence": "high/medium/low"
  }
]

Rules:
- If you find a clear founder/owner/CEO, return their name and role with high confidence
- If you're somewhat sure, use medium confidence
- If you're guessing, use low confidence
- If you cannot find any founder info, return an empty array []
- Be thorough - check for "Founder", "CEO", "Owner", "President", "Managing Director" mentions
- The name should be a real person's name, not a company name`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[v0] GEMINI: API error ${response.status}: ${errorText}`);
      return [];
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      console.log(`[v0] GEMINI: Empty response`);
      return [];
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Find the first [ or { to start parsing
    const arrayStart = jsonStr.indexOf('[');
    if (arrayStart === -1) {
      console.log(`[v0] GEMINI: No JSON array found in response: ${text.substring(0, 200)}`);
      return [];
    }
    jsonStr = jsonStr.substring(arrayStart);

    const arrayEnd = jsonStr.lastIndexOf(']');
    if (arrayEnd === -1) {
      console.log(`[v0] GEMINI: No closing bracket found`);
      return [];
    }
    jsonStr = jsonStr.substring(0, arrayEnd + 1);

    const parsed = JSON.parse(jsonStr);
    
    if (!Array.isArray(parsed)) {
      console.log(`[v0] GEMINI: Response is not an array`);
      return [];
    }

    const founders: GeminiFounderResult[] = parsed
      .filter((f: any) => f.name && typeof f.name === 'string' && f.name.length >= 3)
      .map((f: any) => ({
        name: f.name.trim(),
        role: f.role || 'Founder',
        confidence: ['high', 'medium', 'low'].includes(f.confidence) ? f.confidence : 'medium',
        source: 'gemini' as const,
      }));

    console.log(`[v0] GEMINI: Found ${founders.length} founder(s) for ${domain}:`, 
      founders.map(f => `${f.name} (${f.role})`).join(', '));

    return founders;
  } catch (error) {
    console.error(`[v0] GEMINI: Error analyzing ${url}:`, error);
    return [];
  }
};
