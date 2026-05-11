import prisma from "../utils/prisma";

/**
 * Progress Tracking Service
 * 
 * Provides a centralized way to update scraping progress for stores.
 * Each step in the pipeline updates the progress percentage and status text.
 */

export type ScrapingStatus = "idle" | "queued" | "scraping" | "enriching" | "scoring" | "complete" | "error";

interface ProgressUpdate {
  status: ScrapingStatus;
  progress: number;
  statusText: string;
}

/**
 * Update the scraping progress for a store
 */
export const updateProgress = async (
  storeId: string,
  update: ProgressUpdate
): Promise<void> => {
  try {
    await prisma.store.update({
      where: { id: storeId },
      data: {
        scrapingStatus: update.status,
        scrapingProgress: update.progress,
        scrapingStatusText: update.statusText,
      },
    });
  } catch (error) {
    console.error(`[v0] Failed to update progress for store ${storeId}:`, error);
  }
};

/**
 * Mark scraping as complete
 */
export const markScrapingComplete = async (storeId: string): Promise<void> => {
  await updateProgress(storeId, {
    status: "complete",
    progress: 100,
    statusText: "Complete",
  });
  
  await prisma.store.update({
    where: { id: storeId },
    data: { scrapedAt: new Date() },
  });
};

/**
 * Mark scraping as errored
 */
export const markScrapingError = async (storeId: string, errorMessage: string): Promise<void> => {
  await updateProgress(storeId, {
    status: "error",
    progress: 0,
    statusText: `Error: ${errorMessage.substring(0, 100)}`,
  });
};

/**
 * Mark a store's scraping as stale/timed out
 * Used when a job has been running too long without completing
 */
export const markStoreStale = async (storeId: string): Promise<void> => {
  await updateProgress(storeId, {
    status: "error",
    progress: 0,
    statusText: "Stopped (timeout)",
  });
};


/**
 * Get the current progress for a store
 */
export const getProgress = async (storeId: string) => {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      scrapingStatus: true,
      scrapingProgress: true,
      scrapingStatusText: true,
      scrapedAt: true,
    },
  });
  
  return store;
};

/**
 * Progress step definitions with their percentage ranges
 */
export const PROGRESS_STEPS = {
  QUEUED: { status: "queued" as ScrapingStatus, progress: 0, statusText: "Queued for scraping..." },
  FETCHING_HTML: { status: "scraping" as ScrapingStatus, progress: 10, statusText: "Fetching website HTML..." },
  DETECTING_SHOPIFY: { status: "scraping" as ScrapingStatus, progress: 25, statusText: "Detecting platform..." },
  EXTRACTING_SOCIAL: { status: "scraping" as ScrapingStatus, progress: 40, statusText: "Extracting social links..." },
  EXTRACTING_EMAILS: { status: "scraping" as ScrapingStatus, progress: 50, statusText: "Extracting contact info..." },
  EXTRACTING_CONTENT: { status: "scraping" as ScrapingStatus, progress: 60, statusText: "Analyzing page content..." },
  SAVING_DATA: { status: "scraping" as ScrapingStatus, progress: 75, statusText: "Saving scraped data..." },
  ENRICHING_FOUNDER: { status: "enriching" as ScrapingStatus, progress: 80, statusText: "Enriching founder data..." },
  SEARCHING_LINKEDIN: { status: "enriching" as ScrapingStatus, progress: 90, statusText: "Searching LinkedIn..." },
  CALCULATING_SCORE: { status: "scoring" as ScrapingStatus, progress: 95, statusText: "Calculating lead score..." },
  COMPLETE: { status: "complete" as ScrapingStatus, progress: 100, statusText: "Complete!" },
};
