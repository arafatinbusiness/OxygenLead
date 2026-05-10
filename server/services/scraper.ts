import prisma from "../utils/prisma";
import * as cheerio from "cheerio";
import axios from "axios";
import { enqueueJob } from "../queue/queue";
import { updateProgress, PROGRESS_STEPS } from "./progress";



/**
 * RAW DATA LAYER - Scraper Service
 * 
 * Responsibilities (ONLY):
 * - Fetch HTML deterministically
 * - Detect Shopify (specific signals only)
 * - Extract raw signals (links, emails, text)
 * - Store raw data
 * 
 * NO INTELLIGENCE HERE - Just facts from the page
 */

interface RawScrapedData {
  // Basic info
  title: string;
  metaDescription: string;
  
  // Shopify detection only
  isShopify: boolean;
  
  // Ecommerce signals
  isEcommerce: boolean;
  
  // Raw extractions (NO interpretation)
  socialLinks: Array<{ platform: string; handle: string; url: string }>;
  emails: string[];
  aboutPageUrl?: string;
  jobsPageUrl?: string;
  contactFormExists: boolean;
  
  // Raw text sections (for later enrichment)
  aboutText: string;
  footerText: string;
  navText: string;
}

/**
 * SHOPIFY DETECTION - Only deterministic patterns
 * Looks for: CDN, API endpoints, meta tags - NOT guessing
 */
const SHOPIFY_PATTERNS = [
  /cdn\.shopify\.com/,          // Shopify CDN - definitive
  /\/products\.json/,            // Shopify API endpoint
  /\/api\/\d+\/graphql\.json/,  // Shopify GraphQL endpoint
  /myshopify\.com/,              // Shopify domain
  /Shopify\.shop/,               // Shopify global variable
];

/**
 * ECOMMERCE SIGNALS - Content-based only
 * Multiple signals increase confidence
 */
const ECOMMERCE_SIGNALS = [
  // CTA buttons
  { pattern: /add to cart|add to bag|buy now|shop now|purchase|add to basket/i, weight: 3 },
  // Pricing
  { pattern: /\$[\d,]+\.?\d{0,2}|£\d+|€\d+/i, weight: 2 },
  // Product language
  { pattern: /product|products|catalog|collection|sku|inventory/i, weight: 2 },
  // Checkout
  { pattern: /checkout|payment|shipping|billing|cart|order/i, weight: 2 },
];

const MIN_ECOMMERCE_SCORE = 4; // Need at least 4 points

/**
 * Detect if store runs on Shopify
 * ONLY uses definitive signals - no guessing
 */
const detectShopify = (html: string): boolean => {
  for (const pattern of SHOPIFY_PATTERNS) {
    if (pattern.test(html)) {
      console.log(`[v0] Shopify detected: pattern match`);
      return true;
    }
  }
  return false;
};

/**
 * Detect if site is e-commerce
 * Uses scoring - multiple signals required
 */
const detectEcommerce = (html: string): boolean => {
  let score = 0;
  
  for (const signal of ECOMMERCE_SIGNALS) {
    if (signal.pattern.test(html)) {
      score += signal.weight;
    }
  }
  
  const isEcommerce = score >= MIN_ECOMMERCE_SCORE;
  console.log(`[v0] Ecommerce detection: score=${score}, result=${isEcommerce}`);
  return isEcommerce;
};

/**
 * MAIN SCRAPER - BASE LAYER
 * 
 * Does NOT interpret data.
 * Just collects raw signals and stores them.
 */
export const scrapeStore = async (storeId: string, url: string): Promise<RawScrapedData> => {
  try {
    console.log(`[v0] SCRAPER: Starting for ${storeId}: ${url}`);

    // Report: Fetching HTML
    await updateProgress(storeId, PROGRESS_STEPS.FETCHING_HTML);

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // --- STEP 1: Deterministic Detection ---
    await updateProgress(storeId, PROGRESS_STEPS.DETECTING_SHOPIFY);
    const isShopify = detectShopify(html);
    const isEcommerce = detectEcommerce(html);

    // --- STEP 2: Raw Data Extraction ---
    await updateProgress(storeId, PROGRESS_STEPS.EXTRACTING_SOCIAL);
    const title = $("title").text().split("|")[0].trim() || new URL(url).hostname;
    const metaDescription = $('meta[name="description"]').attr("content") || "";
    const socialLinks = extractSocialLinks($);

    await updateProgress(storeId, PROGRESS_STEPS.EXTRACTING_EMAILS);
    const emails = extractEmails(html);
    const contactFormExists = html.includes("form") && html.includes("contact");

    await updateProgress(storeId, PROGRESS_STEPS.EXTRACTING_CONTENT);
    // Extract text sections (RAW - no interpretation)
    const aboutText = extractSectionText($, ["about", "our-story", "who-we-are"]);
    const footerText = $("footer").text();
    const navText = $("nav").text();

    // Find about/jobs pages (raw URLs only)
    const aboutPageUrl = findPageUrl($, url, ["about", "our-story", "who"]);
    const jobsPageUrl = findPageUrl($, url, ["careers", "jobs", "join", "hiring"]);

    // --- STEP 3: Store Raw Data ---
    const rawData: RawScrapedData = {
      title,
      metaDescription,
      isShopify,
      isEcommerce,
      socialLinks,
      emails,
      aboutPageUrl,
      jobsPageUrl,
      contactFormExists,
      aboutText: aboutText.substring(0, 2000), // Limit for DB
      footerText: footerText.substring(0, 1000),
      navText: navText.substring(0, 500),
    };

    // --- STEP 4: Save to Database ---
    await updateProgress(storeId, PROGRESS_STEPS.SAVING_DATA);
    await prisma.store.update({
      where: { id: storeId },
      data: {
        storeName: title,
        scrapedAt: new Date(),
      },
    });

    // Save social accounts (raw extraction)
    for (const social of socialLinks) {
      // Check if social account already exists
      const existing = await prisma.socialAccount.findFirst({
        where: { storeId, platform: social.platform, handle: social.handle },
      });
      if (!existing) {
        await prisma.socialAccount.create({
          data: {
            storeId,
            platform: social.platform,
            handle: social.handle,
            url: social.url,
          },
        });
      }
    }

    // Save raw data snapshot to history
    await prisma.storeHistory.create({
      data: {
        storeId,
        action: "scraped", // Event type
        details: JSON.stringify({
          isShopify,
          isEcommerce,
          socialCount: socialLinks.length,
          emailCount: emails.length,
          hasAboutPage: !!aboutPageUrl,
          hasJobsPage: !!jobsPageUrl,
          hasContactForm: contactFormExists,
        }),
      },
    });

    console.log(`[v0] SCRAPER: Completed. Ready for enrichment.`);

    // --- STEP 5: Enqueue Enrichment (not AI yet) ---
    // Send raw data to enrichment service, which will decide if AI is needed
    await updateProgress(storeId, PROGRESS_STEPS.ENRICHING_FOUNDER);
    await enqueueJob("ai-enrich-founder", {
      storeId,
      rawData, // Pass structured raw data
    });

    return rawData;
  } catch (error) {
    console.error(`[v0] SCRAPER ERROR for ${storeId}:`, error);

    await prisma.storeHistory.create({
      data: {
        storeId,
        action: "scrape_error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    throw error;
  }
};

/**
 * Extract social media links
 * RAW extraction only - no interpretation
 */
function extractSocialLinks(
  $: cheerio.CheerioAPI
): Array<{ platform: string; handle: string; url: string }> {
  const socials: Array<{ platform: string; handle: string; url: string }> = [];
  const platforms = {
    twitter: /twitter\.com/,
    instagram: /instagram\.com/,
    facebook: /facebook\.com/,
    linkedin: /linkedin\.com/,
    tiktok: /tiktok\.com/,
    youtube: /youtube\.com/,
  };

  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (!href) return;

    for (const [platform, pattern] of Object.entries(platforms)) {
      if (pattern.test(href)) {
        const handle = href.split("/").pop()?.replace("@", "").trim() || "";
        if (handle && handle.length > 1) {
          socials.push({ platform, handle, url: href });
        }
      }
    }
  });

  return socials;
}

/**
 * Extract ALL emails found on page
 * RAW - no validation or filtering
 */
function extractEmails(html: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = html.match(emailRegex) || [];
  return [...new Set(matches)]; // Remove duplicates
}

/**
 * Extract text from sections matching keywords
 */
function extractSectionText($: cheerio.CheerioAPI, keywords: string[]): string {
  let text = "";
  
  $("*").each((_, el) => {
    const id = ($(el).attr("id") || "").toLowerCase();
    const className = ($(el).attr("class") || "").toLowerCase();
    const content = $(el).text().toLowerCase();
    
    for (const keyword of keywords) {
      if (id.includes(keyword) || className.includes(keyword)) {
        text += $(el).text() + " ";
      }
    }
  });

  return text;
}

/**
 * Find page URL by keywords in link text
 */
function findPageUrl(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  keywords: string[]
): string | undefined {
  let found: string | undefined;

  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().toLowerCase();

    for (const keyword of keywords) {
      if (text.includes(keyword) && href && !found) {
        found = resolveUrl(baseUrl, href);
      }
    }
  });

  return found;
}

function resolveUrl(baseUrl: string, relativeUrl: string): string {
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch {
    return relativeUrl;
  }
}
