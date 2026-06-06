import { chromium } from "playwright";
import { ensurePlaywrightBrowsers } from "./fb-ads";

interface GoogleSearchResult {
  url: string;
  title: string;
  snippet: string;
}

interface GoogleScraperResult {
  results: GoogleSearchResult[];
  totalResults: number;
  success: boolean;
  error?: string;
}

/**
 * Scrape Google search results for a given query.
 * Uses Playwright to render the page and extract result URLs.
 *
 * @param query - The Google search query (e.g. 'site:myshopify.com "skincare" -site:shopify.com')
 * @param pages - Number of pages to scrape (1-10)
 * @returns GoogleScraperResult with extracted URLs
 */
export async function scrapeGoogleSearch(
  query: string,
  pages: number = 1
): Promise<GoogleScraperResult> {
  const result: GoogleScraperResult = {
    results: [],
    totalResults: 0,
    success: false,
  };

  // Ensure Playwright browsers are installed
  ensurePlaywrightBrowsers();

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    for (let pageNum = 0; pageNum < pages; pageNum++) {
      const start = pageNum * 10;
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}`;

      console.log(
        `[google-scraper] Searching page ${pageNum + 1}/${pages}: ${url}`
      );

      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      // Wait for results to render
      await page.waitForTimeout(3000);

      // Extract search results
      const pageResults = await page.evaluate(() => {
        const items: { url: string; title: string; snippet: string }[] = [];

        // Try multiple selectors for Google search results
        const selectors = [
          "div.g",
          "div[data-hveid]",
          "div.tF2Cxc",
          "div.g-blk",
          "div[role='heading'] ~ div",
        ];

        let resultDivs: Element[] = [];
        for (const selector of selectors) {
          const found = document.querySelectorAll(selector);
          if (found.length > 0) {
            resultDivs = Array.from(found);
            break;
          }
        }

        // Fallback: look for all <a> tags with href starting with http
        if (resultDivs.length === 0) {
          const links = document.querySelectorAll("a[href^='http']");
          const seen = new Set<string>();
          links.forEach((link) => {
            const href = (link as HTMLAnchorElement).href;
            if (
              !seen.has(href) &&
              !href.includes("google.com") &&
              !href.includes("youtube.com") &&
              !href.includes("facebook.com") &&
              !href.includes("instagram.com")
            ) {
              seen.add(href);
              items.push({
                url: href,
                title: link.textContent?.trim() || "",
                snippet: "",
              });
            }
          });
          return items;
        }

        const seen = new Set<string>();
        for (const div of resultDivs) {
          const link = div.querySelector("a[href^='http']") as HTMLAnchorElement | null;
          if (!link) continue;

          const href = link.href;
          if (
            seen.has(href) ||
            href.includes("google.com") ||
            href.includes("youtube.com") ||
            href.includes("facebook.com") ||
            href.includes("instagram.com") ||
            href.includes("twitter.com") ||
            href.includes("linkedin.com")
          ) {
            continue;
          }
          seen.add(href);

          const title =
            link.querySelector("h3")?.textContent ||
            link.textContent?.trim() ||
            "";

          // Get snippet text
          const snippetEl = div.querySelector(
            ".VwiC3b, .lEBKkf, span.aCOpRe, .st"
          );
          const snippet = snippetEl?.textContent?.trim() || "";

          items.push({ url: href, title, snippet });
        }

        return items;
      });

      result.results.push(...pageResults);
      console.log(
        `[google-scraper] Page ${pageNum + 1}: found ${pageResults.length} results`
      );

      // If not the last page, click "Next" button
      if (pageNum < pages - 1) {
        try {
          const nextButton = page.locator("a#pnnext, a[aria-label='Next'], a:has-text('Next')");
          if (await nextButton.count() > 0) {
            await nextButton.first().click();
            await page.waitForTimeout(2000);
          } else {
            console.log("[google-scraper] No more pages available");
            break;
          }
        } catch {
          console.log("[google-scraper] Failed to navigate to next page");
          break;
        }
      }
    }

    await browser.close();
    result.totalResults = result.results.length;
    result.success = true;
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[google-scraper] Error searching Google for "${query}":`,
      errorMessage
    );
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
