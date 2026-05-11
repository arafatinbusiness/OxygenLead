# OxygenLead Architecture Decisions

## Core Principle: Deterministic → Enrichment → Optional AI

This document explains why each service is structured the way it is.

---

## Layer 1: Scraper Service (DETERMINISTIC BASE)

### Responsibility
- Fetch HTML
- Detect Shopify (specific signals ONLY)
- Extract raw signals
- Store raw data

### Key Rules

**✅ DO:**
- Use regex patterns for detection
- Extract links, emails, text as-is
- Store all raw data without interpretation
- Log what was found, not what it means

**❌ DON'T:**
- Guess about data
- Apply intelligence
- Skip data because it seems unimportant
- Use AI here

### Functions

#### `detectShopify(html)`
Looks for definitive Shopify indicators:
- `/cdn.shopify.com` in HTML
- `/products.json` endpoint
- `/api/graphql.json` endpoint
- `myshopify.com` domain

```typescript
// ✅ GOOD - Specific patterns
const SHOPIFY_PATTERNS = [
  /cdn\.shopify\.com/,
  /\/products\.json/,
  /myshopify\.com/,
];

// ❌ BAD - Guessing
const SHOPIFY_PATTERNS = [
  /shopify|store|selling/i,  // Too vague
];
```

#### `detectEcommerce(html)`
Uses scoring system - needs 4+ points from:
- CTA buttons ("Add to cart", "Buy now") = 3 pts
- Pricing patterns ($100, €50) = 2 pts
- Product language = 2 pts
- Checkout language = 2 pts

This avoids false positives (blog with one "buy" button ≠ ecommerce).

#### `extractRawData()`
Collects WITHOUT interpretation:
- Title, meta description
- All social media links found
- All emails found
- Links to about/jobs pages
- Raw text sections

### Data Flow

```
Fetch HTML
    ↓
Run detectShopify() + detectEcommerce()
    ↓
Extract raw signals (social, emails, pages)
    ↓
Store everything in DB
    ↓
Enqueue enrichment job
```

---

## Layer 2: Enrichment Service (SMART LAYER)

### Responsibility
- Extract founders intelligently
- Classify business type
- Decide if AI is needed

### Key Rules

**PATTERNS FIRST, AI FALLBACK ONLY**

Why?
1. **Patterns are cheap** - Free, instant, always works
2. **Patterns are reliable** - Same input = same output
3. **Most sites have explicit info** - "Founded by X" is common
4. **AI is expensive** - $0.001+ per call
5. **AI is variable** - Same text might give different results

### Pattern-Based Extraction

```typescript
// EXPLICIT mentions (High confidence)
/founded\s+(?:by|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/

// Works on: "Founded by Sarah Chen" → "Sarah Chen"

// LEADERSHIP mentions (Medium confidence)
/ceo\s*[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/

// Works on: "CEO: John Smith" → "John Smith"
```

### Decision Logic

```
Pattern extraction
    ↓
High-confidence results? (e.g., "Founded by X")
    ├─ YES → Use patterns only, done
    └─ NO → Try AI (if key available)
    ↓
AI enrichment (optional)
    ↓
Store result + metadata
```

### Why Confidence Levels?

```typescript
interface FounderInfo {
  name: string;
  role: string;
  confidence: "high" | "medium" | "low";  // IMPORTANT
  source: "pattern" | "ai";                // Track origin
}
```

Benefits:
- Can weight results by confidence
- Easy to debug if something's wrong
- Can request more info for low-confidence founders
- Can measure pattern effectiveness over time

### When to Use AI

Only if:
1. Patterns found nothing
2. Patterns found only low-confidence results
3. OpenAI API key is set
4. Recent call didn't timeout

Never:
- Send every site to AI
- Use AI without trying patterns first
- Ignore pattern results in favor of AI

---

## Layer 3: LinkedIn Search (PLACEHOLDER)

### Responsibility
- Search for founders on LinkedIn
- Match company page

### Current Implementation
Returns mock data - ready for real API integration

---

## Layer 4: Scoring Engine

### Responsibility
- Score leads 0-100
- Use all available data

### Scoring Components

| Factor | Points | Source |
|--------|--------|--------|
| Founder visibility | 25 | Social count + bios |
| Branding quality | 20 | Site design, domain |
| Business maturity | 20 | Revenue, team size |
| Social activity | 15 | Recent posts |
| Custom domain | 10 | Domain type |
| LinkedIn presence | 10 | Profile completeness |

---

## Data Flow: Full Pipeline

```
1. SCRAPER (Deterministic)
   ├─ Fetch HTML
   ├─ Detect Shopify (specific signals)
   ├─ Detect E-commerce (score ≥ 4)
   ├─ Extract raw: links, emails, text
   └─ Store raw data → history log "scraped"

2. ENRICHMENT (Smart)
   ├─ Try patterns (instant)
   ├─ If no results → Try AI (if available)
   ├─ Save founders
   └─ Store result → history log "enriched"

3. LINKEDIN SEARCH
   ├─ Search for each founder
   ├─ Match company page
   └─ Store matches → history log "searched_linkedin"

4. SCORING
   ├─ Calculate composite score
   ├─ Categorize (Hot/Warm/Lukewarm/Cold)
   └─ Store score → history log "scored"
```

---

## History Tracking (Audit Trail)

Every action is logged:

```typescript
await prisma.storeHistory.create({
  data: {
    storeId,
    action: "scraped",        // Event type
    details: JSON.stringify({  // Snapshot
      isShopify,
      isEcommerce,
      socialCount: 3,
      emailCount: 1,
    }),
  },
});
```

Benefits:
- Full debugging visibility
- Can replay what happened
- Can measure performance
- Can detect regressions

---

## Cost Optimization

### Current Costs (per 1000 stores)

| Operation | Cost | Notes |
|-----------|------|-------|
| Scraping | Free | HTTP requests |
| Pattern extraction | Free | Regex matching |
| AI enrichment (if needed) | ~$1 | Only when patterns fail |
| LinkedIn search | ~$0 | Placeholder |
| Scoring | Free | Local calculation |
| **Total** | ~$1 | 99.9% free! |

### How to Stay Cheap

1. **Patterns work for 80%+ of sites**
2. Only use AI for ambiguous cases
3. Batch AI calls (future optimization)
4. Cache results (already done)
5. Skip AI if cost limit reached

---

## Testing This Architecture

### Pattern Extraction Test

```bash
curl -X POST http://localhost:3001/api/stores \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.brightland.co"}'
```

Should extract founders via patterns without calling API.

### View History

```bash
curl http://localhost:3001/api/stores/{storeId}/history \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Look for:
- `action: "scraped"` - Base data collected
- `action: "enriched"` - Founder extraction (check if AI was used)
- `action: "searched_linkedin"` - LinkedIn matching
- `action: "scored"` - Final score calculated

---

## Future Improvements

### Phase 2: LinkedIn API Integration
- Real founder-to-LinkedIn matching
- Company page extraction
- Engagement metrics

### Phase 3: Advanced Scraping
- Playwright for JavaScript sites
- PDF document extraction
- Video transcript analysis

### Phase 4: Batch AI Processing
- Group similar sites
- Send batch queries to API
- Reduce cost per site

### Phase 5: Custom Models
- Fine-tune model on your data
- Use lightweight models for speed
- Edge cases handled locally

---

## Key Takeaways

✅ **Patterns are your friend** - Free, fast, reliable
❌ **Avoid generic AI calls** - Expensive, variable
📊 **Track everything** - History is gold
🎯 **Score based on all available data** - Don't skip signals
🔄 **Make it iterable** - Start simple, improve over time
