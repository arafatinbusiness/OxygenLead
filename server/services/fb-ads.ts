import { chromium } from "playwright";
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";

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
 * Check if Playwright browsers are installed by looking for the
 * chromium-headless-shell executable at the expected cache path.
 */
function arePlaywrightBrowsersInstalled(): boolean {
  const home = process.env.HOME || "/root";
  const cacheDir = process.env.PLAYWRIGHT_BROWSERS_PATH ||
    path.join(home, ".cache", "ms-playwright");
  const browserDir = path.join(cacheDir, "chromium_headless_shell-1217");
  const executable = path.join(browserDir, "chrome-headless-shell-linux64", "chrome-headless-shell");
  return fs.existsSync(executable);
}

/**
 * Find the playwright-core CLI path in node_modules.
 */
function findPlaywrightCliPath(): string | null {
  // Check common locations
  const candidates = [
    path.join(process.cwd(), "node_modules", "playwright-core", "cli.js"),
    path.join(process.cwd(), "node_modules", "playwright", "cli.js"),
  ];

  // Check pnpm store
  const pnpmDir = path.join(process.cwd(), "node_modules", ".pnpm");
  if (fs.existsSync(pnpmDir)) {
    try {
      const coreDirs = fs.readdirSync(pnpmDir).filter((f) => f.startsWith("playwright-core@"));
      if (coreDirs.length > 0) {
        candidates.push(
          path.join(pnpmDir, coreDirs[0], "node_modules", "playwright-core", "cli.js")
        );
      }
    } catch {
      // Ignore read errors
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Ensure Playwright browsers are installed.
 * If the browser executable is missing, auto-install it.
 */
function ensurePlaywrightBrowsers(): void {
  if (arePlaywrightBrowsersInstalled()) {
    return;
  }

  console.log("[fb-ads] Playwright browsers not found, installing...");
  try {
    const cliPath = findPlaywrightCliPath();
    if (cliPath) {
      execSync(`node "${cliPath}" install chromium-headless-shell`, {
        stdio: "inherit",
        timeout: 120000,
      });
    } else {
      // Fallback: try npx
      execSync("npx playwright install chromium-headless-shell", {
        stdio: "inherit",
        timeout: 120000,
      });
    }
    console.log("[fb-ads] Playwright browsers installed successfully");
  } catch (installError) {
    console.error("[fb-ads] Failed to install Playwright browsers:", installError);
  }
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

  // Ensure browsers are installed before launching
  ensurePlaywrightBrowsers();

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
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
  const adWord = adCount === 1 ? "ad" : "ads";
  return `You've only got ${adCount} active meta ${adWord} scheduled and maybe your current priorities are from organic sales.`;
}
