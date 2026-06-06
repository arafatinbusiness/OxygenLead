import { Router, Response } from "express";
import prisma from "../utils/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { enqueueJob } from "../queue/queue";
import { updateProgress, getProgress, PROGRESS_STEPS } from "../services/progress";
import { quickFounderLookup } from "../services/gemini";
import { scrapeFbAdsLibrary, buildImprovement1Text } from "../services/fb-ads";
import { scrapeGoogleSearch } from "../services/google-scraper";
import { validateStores } from "../services/store-validator";

const router = Router();



// Get all stores for user with pagination
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { skip = 0, take = 20, sortBy = "createdAt", order = "desc" } = req.query;
    const skipNum = parseInt(skip as string);
    const takeNum = parseInt(take as string);

    const stores = await prisma.store.findMany({
      where: { userId: req.userId },
      orderBy: { [sortBy as string]: order as "asc" | "desc" },
      skip: skipNum,
      take: takeNum,
      include: {
        contacts: true,
        founders: true,
        socialAccounts: true,
        linkedinMatches: true,
      },
    });

    const total = await prisma.store.count({
      where: { userId: req.userId },
    });

    res.json({ stores, total, skip: skipNum, take: takeNum });
  } catch (error) {
    console.error("[v0] Get stores error:", error);
    res.status(500).json({ error: "Failed to fetch stores" });
  }
});

// Get single store
router.get("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const store = await prisma.store.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: {
        contacts: true,
        founders: true,
        socialAccounts: true,
        linkedinMatches: true,
        jobListings: true,
        history: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    res.json(store);
  } catch (error) {
    console.error("[v0] Get store error:", error);
    res.status(500).json({ error: "Failed to fetch store" });
  }
});

// Add new store
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Auto-add https:// if no protocol is present (handles "buytake.shop", "buytake.shopify.com", etc.)
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    // Normalize URL: remove trailing slash
    url = url.replace(/\/+$/, "");

    // Extract domain from URL
    const urlObj = new URL(url);

    const domain = urlObj.hostname.replace("www.", "");


    // Check if store already exists for this user
    const existing = await prisma.store.findFirst({
      where: { domain, userId: req.userId },
    });

    if (existing) {
      return res.status(400).json({ error: "Store already exists" });
    }

    // Create store
    const store = await prisma.store.create({
      data: {
        url,
        domain,
        userId: req.userId!,
      },
    });

    // STEP 1: Quick Gemini lookup (1-2 seconds) - no scraping needed
    // This runs immediately and saves the founder if found
    updateProgress(store.id, PROGRESS_STEPS.ANALYZING_WITH_AI).catch(() => {});
    quickFounderLookup(url).then(async (founders) => {
      if (founders.length > 0) {
        console.log(`[v0] Quick Gemini lookup found founder for ${domain}: ${founders[0].name}`);
        for (const founder of founders) {
          try {
            await prisma.founder.create({
              data: {
                storeId: store.id,
                name: founder.name,
                role: founder.role,
              },
            });
          } catch (e) {
            // Founder may already exist
          }
        }
        await prisma.store.update({
          where: { id: store.id },
          data: { enrichedAt: new Date() },
        });
        await updateProgress(store.id, PROGRESS_STEPS.FOUNDER_FOUND);
      } else {
        console.log(`[v0] Quick Gemini lookup found nothing for ${domain}, will use scrape fallback`);
      }
    }).catch((err) => {
      console.error(`[v0] Quick Gemini lookup failed for ${domain}:`, err.message);
    });

    // STEP 2: Enqueue full scraping job (runs in background, may take time)
    await enqueueJob("crawl-store", { storeId: store.id, url });

    res.status(201).json(store);

  } catch (error) {
    console.error("[v0] Add store error:", error);
    res.status(500).json({ error: "Failed to create store" });
  }
});

// Get scraping progress for a store
router.get("/:id/progress", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const store = await prisma.store.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: {
        id: true,
        scrapingStatus: true,
        scrapingProgress: true,
        scrapingStatusText: true,
        scrapedAt: true,
      },
    });

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    res.json(store);
  } catch (error) {
    console.error("[v0] Get progress error:", error);
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

// Save a manual search (tracks when user clicks "Search Founder" or custom name search)
router.post("/:id/manual-search", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { query, type } = req.body;

    if (!query || !type) {
      return res.status(400).json({ error: "query and type are required" });
    }

    const store = await prisma.store.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const search = await prisma.manualSearch.create({
      data: {
        query,
        type,
        storeId: req.params.id,
      },
    });

    res.status(201).json(search);
  } catch (error) {
    console.error("[v0] Save manual search error:", error);
    res.status(500).json({ error: "Failed to save search" });
  }
});

// Save a manually entered contact (email + status)
router.post("/:id/manual-contact", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { email, status, personName } = req.body;

    if (!email || !status) {
      return res.status(400).json({ error: "email and status are required" });
    }

    const validStatuses = ["owner", "ceo", "founder", "manager"];
    const normalizedStatus = status.toLowerCase();
    if (!validStatuses.includes(normalizedStatus)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
    }

    const store = await prisma.store.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const contact = await prisma.manualContact.create({
      data: {
        email,
        status,
        personName: personName || null,
        storeId: req.params.id,
      },
    });

    res.status(201).json(contact);
  } catch (error) {
    console.error("[v0] Save manual contact error:", error);
    res.status(500).json({ error: "Failed to save contact" });
  }
});

// Get all manual contacts for a store
router.get("/:id/manual-contacts", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const store = await prisma.store.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const contacts = await prisma.manualContact.findMany({
      where: { storeId: req.params.id },
      orderBy: { createdAt: "desc" },
    });

    res.json(contacts);
  } catch (error) {
    console.error("[v0] Get manual contacts error:", error);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

// Save or update lead export data for a store
router.post("/:id/lead-export", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const store = await prisma.store.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const {
      positivePoint1, positivePoint2, positivePoint3, positivePoint4, positivePoint5,
      positivePoint6, positivePoint7, positivePoint8, positivePoint9, positivePoint10,
      improvement1, improvement2, improvement3, improvement4, improvement5,
      improvement6, improvement7, improvement8, improvement9, improvement10,
      customNotes, quickQuestion, videoLink, imageLink,
    } = req.body;

    const leadExport = await prisma.leadExport.upsert({
      where: { storeId: req.params.id },
      update: {
        positivePoint1, positivePoint2, positivePoint3, positivePoint4, positivePoint5,
        positivePoint6, positivePoint7, positivePoint8, positivePoint9, positivePoint10,
        improvement1, improvement2, improvement3, improvement4, improvement5,
        improvement6, improvement7, improvement8, improvement9, improvement10,
        customNotes, quickQuestion, videoLink, imageLink,
      },
      create: {
        storeId: req.params.id,
        positivePoint1, positivePoint2, positivePoint3, positivePoint4, positivePoint5,
        positivePoint6, positivePoint7, positivePoint8, positivePoint9, positivePoint10,
        improvement1, improvement2, improvement3, improvement4, improvement5,
        improvement6, improvement7, improvement8, improvement9, improvement10,
        customNotes, quickQuestion, videoLink, imageLink,
      },
    });

    res.json(leadExport);
  } catch (error) {
    console.error("[v0] Save lead export error:", error);
    res.status(500).json({ error: "Failed to save lead export data" });
  }
});

// Get lead export data for a store
router.get("/:id/lead-export", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const store = await prisma.store.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const leadExport = await prisma.leadExport.findUnique({
      where: { storeId: req.params.id },
    });

    res.json(leadExport || {});
  } catch (error) {
    console.error("[v0] Get lead export error:", error);
    res.status(500).json({ error: "Failed to fetch lead export data" });
  }
});

// Scan Facebook Ads Library for a store
router.post("/:id/scan-fb-ads", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const store = await prisma.store.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    // Use the domain as the search query
    const query = store.domain;

    console.log(`[fb-ads] Scanning FB Ads Library for "${query}"...`);

    const result = await scrapeFbAdsLibrary(query);

    if (!result.success) {
      return res.status(500).json({
        error: result.error || "Failed to scan Facebook Ads Library",
      });
    }

    // Build the improvement text
    const improvementText = buildImprovement1Text(result.totalAds);

    // Auto-save to lead export if it exists
    const existingLeadExport = await prisma.leadExport.findUnique({
      where: { storeId: req.params.id },
    });

    if (existingLeadExport) {
      await prisma.leadExport.update({
        where: { storeId: req.params.id },
        data: { improvement1: improvementText },
      });
    }

    res.json({
      totalAds: result.totalAds,
      advertiserName: result.advertiserName,
      improvementText,
    });
  } catch (error) {
    console.error("[v0] Scan FB Ads error:", error);
    res.status(500).json({ error: "Failed to scan Facebook Ads Library" });
  }
});

// Google Store Finder: Search Google for stores matching a query
router.post("/google-search", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { query, pages = 1 } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const pagesNum = Math.min(Math.max(1, parseInt(pages) || 1), 10);

    console.log(`[google-search] Searching Google for "${query}" (${pagesNum} pages)...`);

    // Step 1: Scrape Google search results
    const searchResult = await scrapeGoogleSearch(query, pagesNum);

    if (!searchResult.success) {
      return res.status(500).json({
        error: searchResult.error || "Failed to search Google",
      });
    }

    // Step 2: Validate each URL (check if Shopify, extract store name)
    const urls = searchResult.results.map((r) => r.url);
    const validationResult = await validateStores(urls);

    // Step 3: Filter to only Shopify stores
    const shopifyStores = validationResult.stores.filter((s) => s.isShopify);

    res.json({
      totalFound: searchResult.totalResults,
      totalValidated: validationResult.stores.length,
      totalShopify: shopifyStores.length,
      stores: shopifyStores,
      allResults: validationResult.stores,
    });
  } catch (error) {
    console.error("[v0] Google search error:", error);
    res.status(500).json({ error: "Failed to search Google for stores" });
  }
});

// Batch import stores from a list of URLs
router.post("/batch-import", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: "URLs array is required" });
    }

    const results: { url: string; domain: string; status: "added" | "skipped" | "error"; error?: string; storeId?: string }[] = [];

    for (const rawUrl of urls) {
      try {
        let url = rawUrl;

        // Auto-add https:// if no protocol
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          url = "https://" + url;
        }

        // Normalize URL
        url = url.replace(/\/+$/, "");

        // Extract domain
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace("www.", "");

        // Check if store already exists for this user
        const existing = await prisma.store.findFirst({
          where: { domain, userId: req.userId },
        });

        if (existing) {
          results.push({ url, domain, status: "skipped" });
          continue;
        }

        // Create store
        const store = await prisma.store.create({
          data: {
            url,
            domain,
            userId: req.userId!,
          },
        });

        // Enqueue scraping job in background
        enqueueJob("crawl-store", { storeId: store.id, url }).catch((err) => {
          console.error(`[batch-import] Failed to enqueue job for ${domain}:`, err.message);
        });

        // Quick Gemini lookup in background
        quickFounderLookup(url).then(async (founders) => {
          if (founders.length > 0) {
            for (const founder of founders) {
              try {
                await prisma.founder.create({
                  data: {
                    storeId: store.id,
                    name: founder.name,
                    role: founder.role,
                  },
                });
              } catch {
                // Founder may already exist
              }
            }
          }
        }).catch(() => {});

        results.push({ url, domain, status: "added", storeId: store.id });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        results.push({ url: rawUrl, domain: "", status: "error", error: errorMessage });
      }
    }

    const added = results.filter((r) => r.status === "added").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const errors = results.filter((r) => r.status === "error").length;

    res.json({
      total: results.length,
      added,
      skipped,
      errors,
      results,
    });
  } catch (error) {
    console.error("[v0] Batch import error:", error);
    res.status(500).json({ error: "Failed to batch import stores" });
  }
});

// Delete store
router.delete("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const store = await prisma.store.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    await prisma.store.delete({ where: { id: req.params.id } });

    res.json({ message: "Store deleted" });
  } catch (error) {
    console.error("[v0] Delete store error:", error);
    res.status(500).json({ error: "Failed to delete store" });
  }
});

export default router;
