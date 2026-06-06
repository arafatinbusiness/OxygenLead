import { chromium } from "playwright";

interface FbAdsResult {
  /** Total number of active ads found */
  totalAds: number;
  /** The advertiser name found (e.g. "Pearlandrose.je") */
  advertiserName: string | null;
  /** Whether the search was successful */
  success: boolean;
  /** Error message if any */
  error?: string;
}

/**
 * Scrape the Facebook Ads Library for a given domain/store name.
 * Uses Playwright to render the page and extract ad count + advertiser name.
 *
 * @param query - The domain or store name to search for (e.g. "pearlandrose.je")
 * @returns FbAdsResult with ad count and advertiser info
 */
export async function scrapeFbAdsLibrary(query: string): Promise<FbAdsResult> {
  const result: FbAdsResult = {
    totalAds: 0,
    advertiserName: null,
    success: false,
  };

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      channel: "chrome",
    });

    const page = await browser.newPage();

    // Navigate to FB Ads Library with keyword search
    const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(query)}&search_type=keyword_unordered&sort_data[direction]=desc&sort_data[mode]=total_impressions`;

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait for the page to fully render (ads are loaded dynamically)
    await page.waitForTimeout(5000);

    // Extract the body text to find ad count and advertiser names
    const bodyText = await page.evaluate(() => document.body.innerText);

    // Try to find the ad count text like "~28 results" or "28 results"
    const countMatch = bodyText.match(/~?(\d+)\s+results?/i);
    if (countMatch) {
      result.totalAds = parseInt(countMatch[1], 10);
    }

    // Try to find the advertiser name - it appears as the first advertiser name
    // in the results. Look for "Sponsored" text and get the name before it.
    const lines = bodyText.split("\n");
    let foundSponsored = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === "Sponsored" && i > 0) {
        // The line before "Sponsored" is usually the advertiser name
        const advertiserLine = lines[i - 1].trim();
        if (advertiserLine && !result.advertiserName) {
          result.advertiserName = advertiserLine;
        }
        foundSponsored = true;
      }
    }

    // If we found at least one ad, consider it a success
    result.success = result.totalAds > 0 || foundSponsored;

    // If no ads found but we got the page, it means no results
    if (!result.success && bodyText.includes("No results")) {
      result.totalAds = 0;
      result.success = true; // Successfully determined there are no ads
    }

    await browser.close();
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[fb-ads] Error scraping FB Ads Library for "${query}":`, errorMessage);
    result.error = errorMessage;
    result.success = false;

    if (browser) {
      try {
        await browser.close();
      } catch {
        // Ignore close errors
      }
    }

    return result;
  }
}

/**
 * Build the improvement text based on ad count.
 */
export function buildImprovement1Text(adCount: number): string {
  if (adCount === 0) {
    return "I don't see you're running any meta ads for selling your products. There's a high chance that your current priority is totally on organic sales.";
  }
  return `You've only ${adCount} active meta ads scheduled and may be you're current priorities are from organic sales.`;
}
