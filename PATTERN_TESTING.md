# Pattern Extraction Testing Guide

## Quick Test: Does Pattern Extraction Work?

### Test 1: High-Confidence Founder Mention

**Test URL:** https://www.brightland.co (About page)

**Expected Pattern Match:**
```
"Founded by" → Should extract founder name
```

**What to Check:**
1. Add store to OxygenLead
2. Check history logs - should see `action: "enriched"` with `usedAI: false`
3. Verify founder extracted via pattern, not AI

**Verify via API:**
```bash
curl http://localhost:3001/api/stores/{storeId}/history \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Should show:
```json
{
  "action": "enriched",
  "details": {
    "foundersCount": 1,
    "patternMatches": 1,
    "aiMatches": 0,
    "usedAI": false,
    "sources": {
      "pattern": 1,
      "ai": 0
    }
  }
}
```

---

### Test 2: CEO/CTO Mention (Medium Confidence)

**Sample Text:**
```
"CEO: Sarah Chen has led the company since 2020"
```

**Expected Pattern:**
```regex
/ceo\s*[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/
```

**Matches:** `Sarah Chen` as role `CEO`, confidence `medium`

**Test Locally:**
```javascript
const text = "CEO: Sarah Chen has led...";
const pattern = /ceo\s*[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi;
const match = pattern.exec(text);
console.log(match[1]); // "Sarah Chen"
```

---

## Pattern Reference

### All Current Patterns

| Pattern | Example | Confidence |
|---------|---------|------------|
| `/founded\s+(?:by\|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/` | "Founded by Sarah" | HIGH |
| `/founder[s]?\s*[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/` | "Founder: John" | HIGH |
| `/co-founder[s]?\s*[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/` | "Co-founder: Jane" | HIGH |
| `/ceo\s*[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/` | "CEO: Smith" | MEDIUM |
| `/cto\s*[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/` | "CTO: Bob" | MEDIUM |

---

## Testing Shopify Detection

### Test 1: Real Shopify Store

**URL:** https://www.glossier.com (Shopify-powered)

**Patterns to Find:**
```
1. /cdn.shopify.com/ in HTML
2. /api/graphql.json endpoint
3. /products.json endpoint
```

**What to Expect:**
```json
{
  "isShopify": true,
  "details": {
    "isShopify": true,
    "isEcommerce": true
  }
}
```

### Test 2: Custom E-commerce (Not Shopify)

**URL:** https://www.allbirds.com (Custom platform)

**Patterns to Find:**
```
❌ No Shopify CDN
❌ No Shopify API endpoints
✅ Many CTA buttons ("Add to Cart")
✅ Pricing patterns ($100, €50)
```

**What to Expect:**
```json
{
  "isShopify": false,
  "isEcommerce": true,  // Still e-commerce
  "details": {
    "isShopify": false,
    "isEcommerce": true,
    "ecommerceScore": 8  // High score from signals
  }
}
```

---

## Debugging Pattern Extraction

### When Patterns DON'T Match

**Scenario:** Website says "Founded in 2015 by Sarah & John" but only "Sarah" was extracted

**Debug Steps:**

1. **Check the actual text:**
```bash
# Get store detail from API
curl http://localhost:3001/api/stores/{storeId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

2. **Test pattern manually:**
```javascript
const text = "Founded in 2015 by Sarah & John";
const pattern = /founded\s+(?:by|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi;
const matches = [];
let match;
while ((match = pattern.exec(text)) !== null) {
  matches.push(match[1]);
}
console.log(matches); // ["Sarah"]
// Note: "&" breaks the pattern - need space+name pattern
```

3. **Improve pattern:**
```javascript
// OLD: Only captures first name in pair
/founded\s+(?:by|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/

// NEW: Capture multiple founders
/founded\s+(?:by|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s*&\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)*)/
```

---

## E-commerce Scoring Breakdown

### How Score is Calculated

```
Base Score: 0

Rule: "add to cart" (match = +3 points)
Rule: "$" symbol (match = +2 points)
Rule: "product" keyword (match = +2 points)
Rule: "checkout" keyword (match = +2 points)

Minimum needed: 4 points → isEcommerce = true
```

### Example: Glossier

```html
<button>Add to Cart</button>        <!-- +3 points -->
<span>$58.00</span>                 <!-- +2 points -->
<h2>Best Sellers</h2>               <!-- +2 points for "Best" not "product" -->
<a href="/checkout">Checkout</a>    <!-- +2 points -->

Total: 3+2+2 = 7 points ✅ E-commerce
```

### Example: Tech Blog

```html
<a href="/buy-my-course">Buy Now</a>  <!-- +3 points -->
<p>Posted January 2024</p>             <!-- No matches -->

Total: 3 points ❌ NOT e-commerce (need 4+)
```

---

## Integration Test: Full Pipeline

### Setup Test Store

```bash
# Add a test store
curl -X POST http://localhost:3001/api/stores \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example-shopify-store.myshopify.com",
    "domain": "example-shopify-store.myshopify.com"
  }'
```

### Wait for Processing

The queue will process:
1. **Scrape** (5 seconds)
2. **Enrich** (2 seconds - patterns only if successful)
3. **LinkedIn Search** (placeholder - 1 second)
4. **Score** (1 second)

### Verify History

```bash
curl http://localhost:3001/api/stores/{storeId}/history \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected sequence:**

```json
[
  {
    "action": "scraped",
    "details": {
      "isShopify": true,
      "isEcommerce": true,
      "socialCount": 3,
      "emailCount": 2
    }
  },
  {
    "action": "enriched",
    "details": {
      "foundersCount": 1,
      "patternMatches": 1,
      "aiMatches": 0,
      "usedAI": false
    }
  },
  {
    "action": "searched_linkedin",
    "details": {
      "foundersSearched": 1,
      "matchesFound": 1
    }
  },
  {
    "action": "scored",
    "details": {
      "score": 68,
      "category": "Warm"
    }
  }
]
```

---

## Performance Metrics

### What to Monitor

| Metric | Target | Current |
|--------|--------|---------|
| Pattern extraction time | <100ms | ~50ms |
| AI call time (if used) | <2s | ~1.5s |
| False positives (wrong names) | <5% | Track this! |
| Pattern success rate | >80% | Monitor |
| Cost per store | <$0.001 | $0.0001 (patterns) |

---

## Continuous Improvement

### Month 1: Baseline
- Run 100 stores through pipeline
- Track pattern success rate
- Log any missed founders

### Month 2: Refinement
- Add patterns for common missed cases
- Adjust confidence thresholds
- Reduce AI usage

### Month 3: Optimization
- Batch AI calls (not one-by-one)
- Add custom patterns per industry
- Fine-tune scoring weights
