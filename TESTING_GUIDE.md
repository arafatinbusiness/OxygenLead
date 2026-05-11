# OxygenLead Testing Guide

Complete testing workflow for the application.

## Test Data

After running `pnpm db:seed`, you have:

**Demo Account:**
- Email: `demo@oxygenlead.com`
- Password: `password123`

**Test Stores:**
1. Brightland - olive oil e-commerce
2. Glossier - beauty e-commerce
3. Shopify - platform
4. Allbirds - footwear e-commerce
5. Warby Parker - eyewear e-commerce

## Unit Tests

### Test Scraper Detection

```bash
# Test Shopify detection
node -e "
const scraper = require('./server/services/scraper.ts');
const html = '<script src=\"https://cdn.shopify.com/s/\"></script>';
console.log('Shopify detected:', scraper.detectShopify(html, {}));
"
```

### Test Scoring Algorithm

```bash
# View scoring logic
cat server/services/scoring.ts | grep -A 30 "calculateScore"
```

## Manual Testing Workflow

### Step 1: Authentication

```bash
# Test signup
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123",
    "name": "Test User"
  }'

# Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@oxygenlead.com",
    "password": "password123"
  }'
```

### Step 2: Store Creation

```bash
# Add a new store (need JWT token from login)
curl -X POST http://localhost:3001/api/stores \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.brightland.com"
  }'
```

### Step 3: Data Retrieval

```bash
# Get all stores
curl http://localhost:3001/api/stores \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get store with founders
curl http://localhost:3001/api/stores/:storeId \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get founders
curl http://localhost:3001/api/founders?storeId=:storeId \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Frontend Testing

### Test Authentication Flow

1. Visit http://localhost:3000
2. Click "Don't have account? Sign up"
3. Fill form:
   - Email: `newtester@example.com`
   - Name: `Test User`
   - Password: `test12345`
4. Click "Create Account"
5. Should redirect to dashboard

### Test Store Analysis

1. Click "Add Store" button
2. Enter URL: `https://www.allbirds.com`
3. Click "Analyze"
4. Wait 5-10 seconds for scraping
5. Check:
   - Store name appears
   - Shopify badge shows
   - Social media accounts list
   - Founders extracted
   - Lead score calculated

### Test Store Grid

1. View list of stores on dashboard
2. Check each store card shows:
   - Store name
   - Lead score
   - Status badge (Hot/Warm/Lukewarm/Cold)
   - Founder count
3. Click store to open detail view

### Test Store Detail View

1. Click any store from grid
2. Verify detail panel shows:
   - Full store info
   - Founders with roles
   - Social accounts
   - Lead score breakdown
   - Activity history
   - Job listings
3. Click "Close" to return to grid

## Backend API Testing

### Health Check

```bash
curl http://localhost:3001/health
# Should return 200 OK
```

### Queue Job Monitoring

```bash
# Monitor jobs in Redis
docker exec oxygenlead-redis redis-cli

> KEYS "*job*"
> HGETALL bull:job:scraping:1
> LRANGE bull:scraping:active 0 -1
```

### Database Query Test

```bash
# Connect to PostgreSQL
docker exec -it oxygenlead-postgres psql -U oxygenlead -d oxygenlead

# View stores
SELECT id, url, "storeName", "isShopify", "leadScore" FROM "Store" LIMIT 5;

# View founders
SELECT s."storeName", f.name, f.role FROM "Founder" f
JOIN "Store" s ON f."storeId" = s.id LIMIT 5;

# View social accounts
SELECT s."storeName", sa.platform, sa.handle 
FROM "SocialAccount" sa
JOIN "Store" s ON sa."storeId" = s.id LIMIT 5;
```

## Performance Testing

### Load Testing Stores

```bash
# Create 20 test stores
for i in {1..20}; do
  curl -X POST http://localhost:3001/api/stores \
    -H "Authorization: Bearer YOUR_JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"https://example-store-$i.myshopify.com\"}"
done
```

### Monitor Server Logs

```bash
# Frontend logs
# Check browser console (F12)

# Backend logs
# Should see in terminal running "pnpm dev"

# Queue processing
# Check Redis logs
docker logs oxygenlead-redis
```

## Scraper Testing

### Test Different URLs

```bash
# Test basic scraping
curl -X POST http://localhost:3001/api/stores \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.example.com"
  }'
```

### Expected Scraper Behavior

| URL | Detection | Expected |
|-----|-----------|----------|
| brightland.com | Shopify | Yes, Detected |
| glossier.com | Shopify | Yes, Detected |
| warbyparker.com | Shopify | Yes, Detected |
| allbirds.com | Shopify | Yes, Detected |
| shopify.com | Not Shopify | No, Detected |

## Enrichment Testing

### Pattern-Based Extraction

The enrichment service should extract founders using patterns like:
- "Founder: John Smith"
- "Co-Founder & CEO: Jane Doe"
- "Founded by John Smith"

### AI Extraction (Optional)

When `OPENAI_API_KEY` is set:
1. Text is sent to OpenAI
2. Returns JSON array of founders
3. Falls back to patterns if API fails

Test:
```bash
OPENAI_API_KEY=sk-test-key pnpm db:seed
```

## Scoring Testing

### Verify Score Calculation

Visit store detail to see score breakdown:
- Founder Visibility: 0-25 pts
- Branding Quality: 0-20 pts
- Business Maturity: 0-20 pts
- Social Activity: 0-15 pts
- Custom Domain: 0-10 pts
- LinkedIn Presence: 0-10 pts

**Total: 0-100 points**

Scores map to status:
- 80-100: Hot 🔥
- 60-79: Warm 🌡️
- 40-59: Lukewarm 💧
- 0-39: Cold ❄️

## Error Handling Testing

### Network Errors

```bash
# Test invalid URL
curl -X POST http://localhost:3001/api/stores \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"url": "https://invalid-url-12345-xyz.com"}'

# Should return error in history
```

### Missing Auth

```bash
# Request without token
curl http://localhost:3001/api/stores

# Should return 401 Unauthorized
```

### Invalid Store ID

```bash
curl http://localhost:3001/api/stores/invalid-id \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Should return 404 Not Found
```

## Continuous Integration Checklist

- [ ] All API endpoints return correct status codes
- [ ] Authentication tokens are validated
- [ ] Stores are correctly detected as Shopify
- [ ] E-commerce indicators are accurate
- [ ] Founders are extracted (pattern-based)
- [ ] Lead scores are calculated
- [ ] Queue jobs process successfully
- [ ] History entries are logged
- [ ] Social accounts are saved
- [ ] Error handling works correctly
- [ ] Database relationships are intact
- [ ] Frontend loads without errors
- [ ] Auth flow works end-to-end
- [ ] Store analysis completes successfully
- [ ] Detail view displays all info

## Known Limitations

1. **No JavaScript Execution**: Cheerio doesn't run JavaScript
2. **Pattern-Based Founders**: Without OpenAI, extraction is limited to regex patterns
3. **No Real LinkedIn**: LinkedIn matching is placeholder
4. **Basic Shopify Detection**: Uses patterns, not official API
5. **No Email Validation**: Demo uses basic patterns

These can be enhanced by adding:
- Playwright for JS rendering
- OpenAI API for smart extraction
- LinkedIn API integration
- Shopify official API
- Email service integration
