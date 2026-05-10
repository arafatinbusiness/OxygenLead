# Service Layer Reference

Quick lookup for each service's responsibilities.

---

## Scraper Service

**File:** `server/services/scraper.ts`

**Entry Point:** `scrapeStore(storeId, url): Promise<RawScrapedData>`

### What It Does

1. Fetches HTML from URL
2. Runs deterministic detection
3. Extracts raw signals
4. Stores to DB
5. Enqueues enrichment job

### Outputs

```typescript
interface RawScrapedData {
  // Basic info
  title: string;
  metaDescription: string;
  
  // Platform detection
  isShopify: boolean;      // Only definitive signals
  isEcommerce: boolean;    // Score-based (4+ points)
  
  // Extracted signals
  socialLinks: Array<{platform, handle, url}>;
  emails: string[];
  aboutPageUrl?: string;
  jobsPageUrl?: string;
  contactFormExists: boolean;
  
  // Raw text (for enrichment)
  aboutText: string;
  footerText: string;
  navText: string;
}
```

### Functions

| Function | What It Does | Returns |
|----------|-------------|---------|
| `detectShopify(html)` | Looks for `/cdn.shopify.com`, `/products.json`, etc | boolean |
| `detectEcommerce(html)` | Scores content signals, needs 4+ points | boolean |
| `extractSocialLinks($)` | Finds all social media links | Array<{platform, handle, url}> |
| `extractEmails(html)` | Finds all email addresses | string[] |
| `extractSectionText($, keywords)` | Gets text from matching sections | string |
| `findPageUrl($, baseUrl, keywords)` | Finds URL to about/jobs page | string \| undefined |

### History Event

```json
{
  "action": "scraped",
  "details": {
    "isShopify": boolean,
    "isEcommerce": boolean,
    "socialCount": number,
    "emailCount": number,
    "hasAboutPage": boolean,
    "hasJobsPage": boolean,
    "hasContactForm": boolean
  }
}
```

---

## Enrichment Service

**File:** `server/services/enrichment.ts`

**Entry Point:** `enrichFounderData(storeId, textContent): Promise<EnrichmentResult>`

### What It Does

1. Tries pattern-based extraction (FREE)
2. If no results → Tries AI (EXPENSIVE)
3. Saves with confidence levels
4. Enqueues LinkedIn search
5. Enqueues scoring

### Outputs

```typescript
interface EnrichmentResult {
  founders: FounderInfo[];    // Extracted founders
  usedAI: boolean;            // Did we call OpenAI?
  pattern_matches: number;    // How many from patterns?
}

interface FounderInfo {
  name: string;
  role: string;
  confidence: "high" | "medium" | "low";  // How sure?
  source: "pattern" | "ai";                // Where from?
}
```

### Functions

| Function | What It Does | Returns |
|----------|-------------|---------|
| `extractFoundersWithPatterns(text)` | Run all regex patterns, return matches | FounderInfo[] |
| `enrichWithAI(text)` | Call OpenAI if available | FounderInfo[] |
| `enrichFounderData(storeId, text)` | Main pipeline: patterns first, AI fallback | EnrichmentResult |
| `classifyBusinessType(text)` | Rule-based classification | string |

### Decision Logic

```
extractFoundersWithPatterns(text)
  ↓
foundersCount = 0?
  ├─ YES: Try AI (if key available)
  └─ NO: Check confidence
        ├─ highConfidence > 0: Done, use patterns
        └─ highConfidence = 0: Try AI
```

### History Event

```json
{
  "action": "enriched",
  "details": {
    "foundersCount": number,
    "patternMatches": number,
    "aiMatches": number,
    "usedAI": boolean,
    "sources": {
      "pattern": number,
      "ai": number
    }
  }
}
```

### When Patterns Work

```
Text: "Founded by Sarah Chen in 2020"
Pattern: /founded\s+(?:by|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/
Match: "Sarah Chen" → Founder (HIGH confidence)
AI Needed: NO ✅

Text: "Our CEO is John Smith"
Pattern: /ceo\s*[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/
Match: "John Smith" → CEO (MEDIUM confidence)
AI Needed: NO ✅
```

### When AI is Needed

```
Text: "John leads this company..."
Pattern: (no matches)
AI Call: YES (try to clarify)
Result: Might find "John" is the CEO

Text: "Founded by Sarah & John"
Pattern: "Sarah" only (& breaks pattern)
AI Call: YES (to get both names)
Result: Can extract both
```

---

## LinkedIn Search Service

**File:** `server/services/linkedin.ts`

**Entry Point:** `searchLinkedInProfile(founderName, founderRole): Promise<LinkedInMatch>`

### What It Does

Currently: Returns mock data  
Future: Search LinkedIn API for founders

### Outputs

```typescript
interface LinkedInMatch {
  profileUrl: string;
  name: string;
  headline: string;
  connections: number;
  followers: number;
}
```

### History Event

```json
{
  "action": "searched_linkedin",
  "details": {
    "foundersSearched": number,
    "matchesFound": number,
    "profilesLinked": number
  }
}
```

---

## Scoring Service

**File:** `server/services/scoring.ts`

**Entry Point:** `scoreStore(storeId): Promise<{score, category}>`

### What It Does

1. Collects all available data
2. Calculates 6 scoring factors
3. Combines into 0-100 score
4. Categorizes (Hot/Warm/Lukewarm/Cold)
5. Saves result

### Scoring Factors

| Factor | Max Pts | Based On |
|--------|---------|----------|
| Founder visibility | 25 | Social count, bios |
| Branding quality | 20 | Design, domain |
| Business maturity | 20 | Revenue, team |
| Social activity | 15 | Recent posts |
| Custom domain | 10 | Domain type |
| LinkedIn presence | 10 | Profile complete |

### Categories

| Score | Category |
|-------|----------|
| 80-100 | 🔥 Hot (High priority) |
| 60-79 | 🌡️ Warm (Good prospect) |
| 40-59 | 🧊 Lukewarm (Maybe later) |
| 0-39 | ❄️ Cold (Low priority) |

### History Event

```json
{
  "action": "scored",
  "details": {
    "score": number,
    "category": "Hot" | "Warm" | "Lukewarm" | "Cold",
    "breakdown": {
      "founderVisibility": number,
      "brandingQuality": number,
      "businessMaturity": number,
      "socialActivity": number,
      "customDomain": boolean,
      "linkedinPresence": number
    }
  }
}
```

---

## Data Flow: Full Example

```
1. User adds store: "https://www.example.com"

2. SCRAPER runs
   ├─ Fetch HTML
   ├─ detectShopify() → false
   ├─ detectEcommerce() → true (7 points)
   ├─ Extract social: instagram.com/example
   ├─ Extract email: hello@example.com
   ├─ Extract aboutText, footerText, navText
   └─ History: "scraped"

3. ENRICHMENT runs
   ├─ extractFoundersWithPatterns(aboutText)
   ├─ Found: "Sarah Chen" (Founder, HIGH)
   ├─ foundersCount > 0, skip AI
   ├─ Save founder
   └─ History: "enriched" (usedAI: false)

4. LINKEDIN SEARCH runs
   ├─ Search: "Sarah Chen"
   ├─ Find profile: linkedin.com/in/sarah-chen
   ├─ Get: headline, connections, followers
   └─ History: "searched_linkedin"

5. SCORING runs
   ├─ Founder visibility: 20pts (1 founder + 1 social)
   ├─ Branding quality: 18pts (custom domain)
   ├─ Business maturity: 15pts (2+ years)
   ├─ Social activity: 8pts (recent posts)
   ├─ Custom domain: 10pts (example.com)
   ├─ LinkedIn presence: 9pts (1 founder on LinkedIn)
   ├─ Total: 80pts → HOT lead
   └─ History: "scored"

Final result:
  ✅ Store fully analyzed
  ✅ 1 founder extracted (via patterns, no API call)
  ✅ LinkedIn profile found
  ✅ Score: 80 (HOT)
  ✅ Cost: $0 (all patterns + mock LinkedIn)
```

---

## Common Patterns

### Check if AI was used

```javascript
// In your code
const history = await getHistory(storeId);
const enrichedEvent = history.find(e => e.action === 'enriched');
const usedAI = enrichedEvent?.details?.usedAI;

if (usedAI) {
  console.log('This store used AI enrichment');
}
```

### Get founder with highest confidence

```javascript
const store = await getStore(storeId);
const highestConfidence = store.founders.reduce((max, f) => 
  f.confidence > max.confidence ? f : max
);
```

### Track AI usage cost

```javascript
const stores = await getStores();
const enrichmentEvents = stores
  .flatMap(s => s.history)
  .filter(e => e.action === 'enriched' && e.details.usedAI);

const cost = enrichmentEvents.length * 0.0001; // $0.0001 per call
console.log(`AI cost: $${cost.toFixed(4)}`);
```

---

## Monitoring

### Metrics to Track

```typescript
interface ServiceMetrics {
  // Scraper
  scrapeSuccessRate: number;      // % of successful scrapes
  avgScrapeDuration: number;      // ms
  shopifyDetectionRate: number;   // % that were Shopify
  ecommerceDetectionRate: number; // % that were e-commerce
  
  // Enrichment
  patternSuccessRate: number;     // % that patterns found founders
  aiUsageRate: number;            // % that needed AI
  avgFoundersPerStore: number;    // founders extracted
  confidenceDistribution: {       // breakdown of confidence
    high: number;
    medium: number;
    low: number;
  };
  
  // LinkedIn
  matchRate: number;              // % of founders matched
  avgConnectionCount: number;     // avg connections for matched
  
  // Scoring
  avgScore: number;               // average lead score
  categoryDistribution: {         // breakdown of Hot/Warm/etc
    hot: number;
    warm: number;
    lukewarm: number;
    cold: number;
  };
  
  // Cost
  costPerStore: number;           // AI calls only
  totalAICost: number;            // all AI calls
}
```

---

## Troubleshooting

### Founder Not Extracted

**Check:**
1. History shows `action: "enriched"` with `patternMatches: 0`?
2. Website actually has founder info visible?
3. Format matches expected pattern?

**Test Patterns:**
```javascript
// In Node REPL
const patterns = [
  /founded\s+(?:by|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
  /founder[s]?\s*[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
];
const text = "Founded by Sarah Chen"; // Your text
patterns.forEach(p => {
  const match = p.exec(text);
  console.log(p, match?.[1]); // See if it matches
});
```

### AI Called Unexpectedly

**Check:**
1. History shows `usedAI: true`?
2. `patternMatches: 0`?
3. Is `OPENAI_API_KEY` set in env?

**Fix:**
- Add pattern for this case
- Or accept AI call as fallback

### Wrong Score

**Check:**
1. All history events exist? (scraped, enriched, searched, scored)
2. Scoring breakdown in history matches expectation
3. Try manual calculation from data

---

## Adding New Patterns

To improve founder extraction:

```typescript
// In enrichment.ts, add to FOUNDER_PATTERNS
const FOUNDER_PATTERNS = [
  // ... existing patterns ...
  
  // NEW: For companies mentioning founder on leadership page
  {
    pattern: /leadership[^.]*?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)[^.]*?founder/gi,
    role: "Founder",
    confidence: "high" as const,
  },
];
```

Then test:
```javascript
const result = extractFoundersWithPatterns(testText);
// Should find the new pattern
```

---

## Summary

Each service does ONE job well:
- **Scraper:** Fetch raw signals deterministically
- **Enrichment:** Extract meaning smartly (patterns first)
- **LinkedIn:** Find team members
- **Scoring:** Evaluate quality

All are observable via history events and easy to improve over time.
