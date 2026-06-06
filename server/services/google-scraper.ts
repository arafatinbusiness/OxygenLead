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
 * Search Google using the Google Custom Search JSON API.
 * This is much more reliable than scraping with Playwright because:
 * - Google's official API never blocks requests
 * - Returns clean JSON data (no HTML parsing needed)
 * - Much faster (no browser launch)
 *
 * @param query - The Google search query (e.g. 'site:myshopify.com "skincare" -site:shopify.com')
 * @param pages - Number of pages to fetch (1-10, each page = 10 results)
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

  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX;

  if (!apiKey || !cx) {
    result.error =
      "Google API key or Search Engine ID not configured. Set GOOGLE_API_KEY and GOOGLE_CX in .env.local";
    return result;
  }

  try {
    const pagesNum = Math.min(Math.max(1, pages), 10);

    for (let pageNum = 0; pageNum < pagesNum; pageNum++) {
      const start = pageNum * 10 + 1; // API uses 1-based indexing

      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&start=${start}`;

      console.log(
        `[google-scraper] Fetching page ${pageNum + 1}/${pagesNum} (start=${start})`
      );

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[google-scraper] API error (${response.status}):`,
          errorText
        );

        // Check for quota exceeded
        if (response.status === 403 || response.status === 429) {
          result.error = "Google API quota exceeded. You get 100 free queries per day.";
          // Still return what we have so far
          if (result.results.length > 0) {
            result.success = true;
          }
          break;
        }

        result.error = `Google API error: ${response.status}`;
        break;
      }

      const data = await response.json();

      // Extract results
      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          result.results.push({
            url: item.link,
            title: item.title || "",
            snippet: item.snippet || "",
          });
        }
      }

      console.log(
        `[google-scraper] Page ${pageNum + 1}: got ${data.items?.length || 0} results`
      );

      // Check if there are more pages
      if (!data.queries || !data.queries.nextPage) {
        console.log("[google-scraper] No more pages available");
        break;
      }

      // Small delay to avoid rate limiting
      if (pageNum < pagesNum - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

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
    return result;
  }
}
