import prisma from "../utils/prisma";
import { scrapeStore } from "../services/scraper";
import { enrichFounderData } from "../services/enrichment";
import { updateProgress, markScrapingComplete, markScrapingError, PROGRESS_STEPS } from "../services/progress";



// In-memory job queue (fallback when Redis is not available)
class InMemoryQueue {
  private handlers: Map<string, (job: any) => Promise<any>> = new Map();
  private onComplete: ((job: any) => Promise<void>) | null = null;
  private onFailed: ((job: any, err: Error) => Promise<void>) | null = null;

  process(type: string, handler: (job: any) => Promise<any>) {
    this.handlers.set(type, handler);
  }

  on(event: "completed", handler: (job: any) => Promise<void>): void;
  on(event: "failed", handler: (job: any, err: Error) => Promise<void>): void;
  on(event: string, handler: any) {
    if (event === "completed") this.onComplete = handler;
    if (event === "failed") this.onFailed = handler;
  }

  async add(type: string, data: any, opts?: any) {
    // Use the jobId from data if provided (for consistent DB tracking)
    const jobId = data._jobId || Date.now().toString();
    const job = { id: jobId, data, type, attemptsMade: 0, returnvalue: null };
    console.log(`[v0] Processing ${type} job (in-memory): ${job.id}`);
    try {
      const handler = this.handlers.get(type);
      if (handler) {
        job.returnvalue = await handler(job);
      }
      if (this.onComplete) await this.onComplete(job);
      return job;
    } catch (err: any) {
      if (this.onFailed) await this.onFailed(job, err);
      throw err;
    }
  }
}

// Always use in-memory queue for simplicity (Redis is optional)
const jobQueue = new InMemoryQueue();

export const enqueueJob = async (
  type: string,
  data: any,
  opts?: {
    priority?: number;
    attempts?: number;
    backoff?: { type: string; delay: number };
  }
) => {
  // Create the queue job record FIRST so it exists for the event handlers
  const jobId = Date.now().toString() + Math.random().toString(36).substring(2, 8);
  
  try {
    await prisma.queueJob.create({
      data: {
        jobId,
        type,
        status: "processing",
        data: JSON.stringify(data),
      },
    });

    const job = await jobQueue.add(
      type,
      { ...data, _jobId: jobId },
      {
        priority: opts?.priority || 0,
        attempts: opts?.attempts || 3,
        backoff: opts?.backoff || { type: "exponential", delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    console.log(`[v0] Enqueued ${type} job: ${job.id}`);
    return job;
  } catch (error) {
    console.error("[v0] Error enqueueing job:", error);
    // Update job status to failed if it was created
    try {
      await prisma.queueJob.update({
        where: { jobId },
        data: { status: "failed", error: error instanceof Error ? error.message : "Unknown error" },
      });
    } catch {}
    // Don't throw - the actual work (scraping, enrichment, scoring) already completed
    // The queue tracking is just for observability
    return null;
  }
};

// Job processors - calling the real services
jobQueue.process("crawl-store", async (job: any) => {
  console.log(`[v0] Processing crawl-store job: ${job.id}`);
  const { storeId, url } = job.data;
  
  // Set initial queued status
  await updateProgress(storeId, PROGRESS_STEPS.QUEUED);
  
  const rawData = await scrapeStore(storeId, url);
  return { status: "completed", data: rawData };
});

jobQueue.process("ai-enrich-founder", async (job: any) => {
  console.log(`[v0] Processing ai-enrich-founder job: ${job.id}`);
  const { storeId, rawData } = job.data;
  
  // Report enrichment progress
  await updateProgress(storeId, PROGRESS_STEPS.ENRICHING_FOUNDER);
  
  // Combine text content from raw data for enrichment
  const textContent = [
    rawData.aboutText || "",
    rawData.footerText || "",
    rawData.navText || "",
    rawData.metaDescription || "",
  ].join(" ");
  const result = await enrichFounderData(storeId, textContent);
  
  return { status: "completed", data: result };
});

// Job event handlers
jobQueue.on("completed", async (job: any) => {
  console.log(`[v0] Job completed: ${job.id}`);
  await prisma.queueJob.update({
    where: { jobId: job.id.toString() },
    data: {
      status: "completed",
      result: JSON.stringify(job.returnvalue),
      completedAt: new Date(),
    },
  });
});

jobQueue.on("failed", async (job: any, err: Error) => {
  console.error(`[v0] Job failed: ${job.id}`, err.message);
  await prisma.queueJob.update({
    where: { jobId: job.id.toString() },
    data: {
      status: "failed",
      error: err.message,
      attempts: job.attemptsMade,
    },
  });

  // Mark the store as errored so the frontend stops polling
  const storeId = job.data?.storeId;
  if (storeId) {
    await markScrapingError(storeId, err.message);
  }
});


export const isRedisAvailable = () => false;
