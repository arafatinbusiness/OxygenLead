import { chromium } from "playwright";
import { ensurePlaywrightBrowsers } from "./fb-ads";

interface ValidatedStore {
  url: string;
  domain: string;
  storeName: string | null;
  isShopify: boolean;
  error?: string;
}

interface ValidationResult {
  stores: ValidatedStore[];
  success: boolean;
  error?: string;
}

/**
 * Validate a list of URLs by visiting each one and checking if it's a Shopify store.
 * Extracts the store name from the page title.
 *
 * @param urls - Array of URLs to validate
 * @returns ValidationResult with validated stores
 */
export async function validateStores(urls: string[]): Promise<ValidationResult> {
  const result: ValidationResult = {
    stores: [],
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

    for (const url of urls) {
      try {
        const validated = await validateSingleStore(context, url);
        result.stores.push(validated);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        result.stores.push({
          url,
          domain: extractDomain(url),
          storeName: null,
          isShopify: false,
          error: errorMessage,
        });
      }
    }

    await browser.close();
    result.success = true;
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[store-validator] Error:", errorMessage);
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
 * Validate a single store URL.
 */
async function validateSingleStore(
  context: any,
  url: string
): Promise<ValidatedStore> {
  const page = await context.newPage();
  const domain = extractDomain(url);

  try {
    // Navigate to the store
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    // Wait a bit for dynamic content
    await page.waitForTimeout(2000);

    // Get page title
    const title = await page.title();

    // Check if it's a Shopify store by looking for Shopify-specific indicators
    const isShopify = await page.evaluate(() => {
      const html = document.documentElement.innerHTML.toLowerCase();

      // Shopify-specific indicators
      const shopifyIndicators = [
        "/cdn/shop/",
        "shopify.com",
        "shopify.theme",
        "shopify.shop",
        'content="Shopify',
        'name="shopify',
        "myshopify.com",
        "shopify-",
        "powered_by_shopify",
        "window.shopify",
        "ShopifyPay",
        "data-shopify",
      ];

      return shopifyIndicators.some((indicator) => html.includes(indicator));
    });

    // Extract store name from title (remove common suffixes)
    let storeName: string | null = title || null;
    if (storeName) {
      // Clean up common title patterns
      storeName = storeName
        .replace(/\s*[-–|]\s*.*$/, "") // Remove everything after separator
        .replace(/\s*Shopify\s*$/i, "") // Remove trailing "Shopify"
        .trim();
    }

    await page.close();
    return { url, domain, storeName, isShopify };
  } catch (error) {
    await page.close().catch(() => {});
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      url,
      domain,
      storeName: null,
      isShopify: false,
      error: errorMessage,
    };
  }
}

/**
 * Extract domain from a URL string.
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    // Fallback
    return url.replace(/https?:\/\//, "").replace(/\/.*$/, "").replace("www.", "");
  }
}
