# OxygenLead - Architecture Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       USER BROWSER                              │
│                    (http://localhost:3000)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS/REST
                             │
        ┌────────────────────▼────────────────────┐
        │   FRONTEND (Next.js React)              │
        │   ─────────────────────────             │
        │  • Auth Page (login/signup)             │
        │  • Dashboard (store grid)               │
        │  • Store Detail View                    │
        │  • Add Store Form                       │
        │                                         │
        │  Features:                              │
        │  ✓ JWT token management                │
        │  ✓ Local storage cache                 │
        │  ✓ Real-time updates (SWR)             │
        │  ✓ Responsive design                   │
        └────────────────────┬────────────────────┘
                             │
                             │ REST API
                             │ (port 3001)
                             │
        ┌────────────────────▼──────────────────────────────────┐
        │   BACKEND (Express.js)                                │
        │   ────────────────────                                │
        │  Routes:                                              │
        │  • POST /api/auth/login                              │
        │  • POST /api/auth/signup                             │
        │  • GET/POST /api/stores                              │
        │  • GET /api/founders/:storeId                        │
        │  • GET /api/history/:storeId                         │
        │                                                       │
        │  Middleware:                                          │
        │  • JWT verification                                   │
        │  • CORS handling                                      │
        │  • Error handling                                     │
        └────────────────────┬──────────────────────────────────┘
                             │
                  ┌──────────┼──────────┐
                  │          │          │
          ┌───────▼──┐  ┌───▼──────┐  │
          │ Services │  │  Queue   │  │
          └───────┬──┘  └───┬──────┘  │
                  │         │         │
        ┌─────────┴─┬───┬───┴─┬───┬───┴──────┐
        │           │   │     │   │          │
     ┌──▼──┐  ┌───▼─┐ │ ┌──▼─┐ │ ┌──▼──┐
     │Scra-│  │Enri-│ │ │Sco-│ │ │Link-│
     │ping │  │chm. │ │ │ring│ │ │edin │
     └──┬──┘  └───┬─┘ │ └──┬─┘ │ └──┬──┘
        │         │   │    │   │    │
        │   Cheerio   │ Algo │   │ Pattern
        │  HTML Parse │    │   │  Matching
        │             │    │   │
        └─────────────┴────┴───┴─────┐
                                     │
                 ┌───────────────────▼─────────────────┐
                 │   BullMQ Job Queue (Redis)          │
                 │   ──────────────────────            │
                 │  • crawl-store                      │
                 │  • ai-enrich-founder                │
                 │  • search-linkedin                  │
                 │  • score-lead                       │
                 │                                     │
                 │  Features:                          │
                 │  ✓ Async processing                │
                 │  ✓ Retry logic (exponential backoff)│
                 │  ✓ Dead letter queue                │
                 │  ✓ Job tracking                     │
                 └───────────────┬─────────────────────┘
                                 │
                  ┌──────────────┬┴──────────────┐
                  │              │               │
          ┌───────▼────┐  ┌──────▼───┐  ┌──────▼──────┐
          │ PostgreSQL │  │  Redis   │  │ External    │
          │ Database   │  │  Cache   │  │ APIs        │
          │ (port 5432)│  │(port 6379)  │ (Optional)  │
          │            │  │             │             │
          │ Tables:    │  │ Features:   │ • OpenAI    │
          │ • User     │  │ • Job queue │ • Shopify   │
          │ • Store    │  │ • Caching   │ • LinkedIn  │
          │ • Founder  │  │             │             │
          │ • Contact  │  │             │             │
          │ • Social   │  │             │             │
          │ • LinkedIn │  │             │             │
          │ • Job      │  │             │             │
          │ • History  │  │             │             │
          │ • Queue    │  │             │             │
          └────────────┘  └─────────────┘  └──────────┘
```

---

## Data Flow Diagram

### Scenario: Add New Store

```
User clicks "Add Store"
         │
         ▼
User enters URL (e.g., allbirds.com)
         │
         ▼
Frontend sends POST /api/stores { url }
         │
         ▼
Backend validates & creates Store record
         │
         ▼
Enqueue "crawl-store" job
         │
         ▼
Queue worker picks up job
         │
         ▼
Scraper Service:
  ├─ Fetch HTML from URL
  ├─ Parse with Cheerio
  ├─ detectShopify() → isShopify: true/false
  ├─ detectEcommerce() → isEcommerce: true/false
  ├─ extractSocialLinks() → Array<Social>
  ├─ extractEmail() → contactEmail?
  ├─ Update Store table
  ├─ Save social accounts
  ├─ Create history entry
  └─ Enqueue "ai-enrich-founder"
         │
         ▼
Enrichment Service:
  ├─ Try OpenAI extraction (if key available)
  │  └─ Send text to GPT-3.5-turbo
  │     └─ Parse founder JSON
  ├─ Fallback to Pattern matching
  │  └─ Apply regex patterns
  │     └─ Extract names & roles
  ├─ Save founders to database
  ├─ Create history entry
  ├─ Enqueue "search-linkedin" (placeholder)
  └─ Enqueue "score-lead"
         │
         ▼
Scoring Service:
  ├─ Calculate founder visibility (0-25)
  ├─ Calculate branding (0-20)
  ├─ Calculate maturity (0-20)
  ├─ Calculate social activity (0-15)
  ├─ Calculate custom domain (0-10)
  ├─ Calculate LinkedIn presence (0-10)
  ├─ Sum total (0-100)
  ├─ Determine status (Hot/Warm/Lukewarm/Cold)
  ├─ Update Store.leadScore
  ├─ Create history entry
  └─ Publish update to frontend
         │
         ▼
Frontend receives update via polling
         │
         ▼
Store appears in grid with:
  • Store name
  • Lead score
  • Status badge
  • Founder count
  • Social count
```

---

## Database Schema

```
┌─────────────────────────────────────────────────────────────┐
│                        User                                 │
│ ────────────────────────────────────────────────────────    │
│ id (UUID)                                                   │
│ email (unique)                                              │
│ name                                                        │
│ passwordHash                                                │
│ createdAt, updatedAt                                        │
└──────────────────┬──────────────────────────────────────────┘
                   │ 1:many
                   │
        ┌──────────▼──────────────────────────────────────────┐
        │                  Store                              │
        │ ──────────────────────────────────────────────      │
        │ id (UUID)                                           │
        │ userId (FK → User)                                  │
        │ url                                                 │
        │ storeName                                           │
        │ description                                         │
        │ isShopify (boolean)                                 │
        │ isEcommerce (boolean)                               │
        │ leadScore (0-100)                                   │
        │ leadStatus (hot/warm/lukewarm/cold)                 │
        │ scrapedAt, enrichedAt                               │
        │ createdAt, updatedAt                                │
        └──┬──────────────────┬──────────────────┬────────────┘
           │ 1:many           │ 1:many           │ 1:many
           │                  │                  │
    ┌──────▼────┐  ┌──────────▼──────┐  ┌───────▼──────┐
    │  Founder   │  │  SocialAccount  │  │   Contact    │
    │ ────────── │  │ ──────────────  │  │ ──────────── │
    │ id         │  │ id              │  │ id           │
    │ storeId    │  │ storeId         │  │ storeId      │
    │ name       │  │ platform        │  │ email        │
    │ role       │  │ handle          │  │ name         │
    │ bio        │  │ url             │  │ title        │
    │ linkedinId │  │ followers       │  │ linkedinUrl  │
    │ visibility │  │ lastUpdated     │  │ social       │
    └────────────┘  └─────────────────┘  └──────────────┘

    ┌─────────────────────────────────────────────────────┐
    │            StoreHistory (Audit Log)                 │
    │ ──────────────────────────────────────────────      │
    │ id (UUID)                                           │
    │ storeId (FK → Store)                                │
    │ action (scrape_completed, enrichment_completed...)  │
    │ details (JSON)                                      │
    │ error (nullable)                                    │
    │ timestamp                                           │
    └─────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────┐
    │              QueueJob (Job Tracking)                │
    │ ──────────────────────────────────────────────      │
    │ id (UUID)                                           │
    │ type (crawl-store, ai-enrich, etc)                  │
    │ storeId (FK → Store)                                │
    │ status (pending, processing, completed, failed)     │
    │ payload (JSON)                                      │
    │ result (JSON)                                       │
    │ attempt (retry count)                               │
    │ createdAt, completedAt                              │
    └─────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────┐
    │          LinkedinMatch (Future)                     │
    │ ──────────────────────────────────────────────      │
    │ id                                                  │
    │ storeId (FK → Store)                                │
    │ founderId (FK → Founder)                            │
    │ linkedinUrl                                         │
    │ matchScore                                          │
    │ verified                                            │
    └─────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────┐
    │          JobListing (Future)                        │
    │ ──────────────────────────────────────────────      │
    │ id                                                  │
    │ storeId (FK → Store)                                │
    │ title                                               │
    │ url                                                 │
    │ postedAt                                            │
    └─────────────────────────────────────────────────────┘
```

---

## Service Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   API Routes                                │
├─────────────────────────────────────────────────────────────┤
│ /auth/login      /stores    /founders    /history           │
└────────┬──────────┬──────────┬──────────┬────────────────────┘
         │          │          │          │
         ▼          ▼          ▼          ▼
┌──────────────────────────────────────────────────────────────┐
│              Middleware Layer                                │
├──────────────────────────────────────────────────────────────┤
│ • JWT Authentication    • Error Handling                     │
│ • CORS Validation       • Request Logging                    │
│ • Rate Limiting (optional)                                   │
└──────────┬─────────────────────────────────────────────────┬─┘
           │                                                 │
           ▼                                                 ▼
    ┌─────────────────┐                              ┌──────────────┐
    │  Auth Service   │                              │Queue Service │
    │ ─────────────── │                              │──────────────│
    │• Register       │                              │• Enqueue job │
    │• Login          │                              │• Get status  │
    │• Validate JWT   │                              │• Track job   │
    └────────┬────────┘                              └──────┬───────┘
             │                                               │
    ┌────────▼───────────────────────────────────────────────▼──────┐
    │              Data Persistence                                  │
    ├──────────────────────────────────────────────────────────────  │
    │                                                                │
    │  Scraper      │ Enrichment    │ Scoring      │ LinkedIn       │
    │  ─────────    │ ──────────    │ ───────      │ ────────       │
    │ • Fetch HTML  │• Extract      │• Calc score  │• Find profile │
    │ • Parse       │  founders     │• Determine  │• Match founder│
    │ • Detect      │• Extract      │  status     │• Verify match │
    │  Shopify      │  roles        │            │                │
    │ • Extract     │• Save data    │            │                │
    │  socials      │               │            │                │
    │                                                                │
    └────────────────────────────────────────────────────────────────┘
           │
           │ All services use Prisma ORM
           │
           ▼
    ┌──────────────────────────┐
    │   PostgreSQL Database    │
    │   (9 Tables + Indexes)   │
    └──────────────────────────┘
```

---

## Request/Response Flow

### Typical Store Analysis Request

```
1. Frontend
   POST /api/stores
   {
     "url": "https://www.allbirds.com"
   }

2. Backend receives request
   ├─ Validate JWT token
   ├─ Validate URL format
   └─ Create Store record (pending)

3. Enqueue job
   {
     type: "crawl-store",
     storeId: "uuid-123",
     url: "https://www.allbirds.com"
   }

4. Queue worker processes
   └─ Scraper.scrapeStore()
      ├─ Fetch & parse HTML
      ├─ detectShopify()
      ├─ detectEcommerce()
      ├─ Extract socials
      ├─ Update Store
      └─ Enqueue enrichment

5. Enrichment worker processes
   └─ Enrichment.enrichFounderData()
      ├─ Try OpenAI (if key set)
      ├─ Fallback to patterns
      ├─ Save founders
      └─ Enqueue scoring

6. Scoring worker processes
   └─ Scoring.scoreStore()
      ├─ Calculate metrics
      ├─ Determine status
      ├─ Update Store
      └─ Create history

7. Frontend polls GET /api/stores/:id
   ├─ Receives updated Store
   ├─ With founders, socials, score
   └─ Displays in UI
```

---

## Error Handling Flow

```
Error occurs
    │
    ├─ Network error
    │  └─ Retry with exponential backoff
    │     ├─ Attempt 1: immediate
    │     ├─ Attempt 2: after 5 seconds
    │     └─ Attempt 3: after 25 seconds
    │
    ├─ Parse error
    │  └─ Log error
    │     └─ Continue with available data
    │
    ├─ API error (OpenAI unavailable)
    │  └─ Use pattern-based extraction
    │     └─ Continue gracefully
    │
    └─ Database error
       └─ Rollback transaction
          └─ Add to dead letter queue
             └─ Alert admin

All errors:
├─ Logged with context
├─ Stored in StoreHistory
├─ Tracked in QueueJob
└─ User notified via history
```

---

## Deployment Diagram

```
┌─────────────────────────────────────────────────────────┐
│           Load Balancer / CDN (Vercel)                  │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
    ┌───▼──┐    ┌───▼──┐    ┌───▼──┐
    │ FE#1 │    │ FE#2 │    │ FE#3 │  (Next.js replicas)
    └──────┘    └──────┘    └──────┘
        │            │            │
        └────────────┼────────────┘
                     │
             API Gateway
                     │
        ┌────────────┼────────────┐
        │            │            │
    ┌───▼──┐    ┌───▼──┐    ┌───▼──┐
    │ BE#1 │    │ BE#2 │    │ BE#3 │  (Express replicas)
    └──────┘    └──────┘    └──────┘
        │            │            │
        └────────────┼────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
│PostgreSQL│  │   Redis    │  │   Queue    │
│(RDS)     │  │ (Elasticache)  │ Workers    │
└──────────┘  └────────────┘  └────────────┘
```

---

## Environment & Configuration

```
Local Development (Docker)
├─ PostgreSQL:5432
├─ Redis:6379
├─ Frontend:3000
└─ Backend:3001

Staging (Cloud)
├─ PostgreSQL (RDS)
├─ Redis (ElastiCache)
├─ Frontend (Vercel)
└─ Backend (Railway/Render)

Production (Cloud)
├─ PostgreSQL (RDS with backups)
├─ Redis (ElastiCache with persistence)
├─ Frontend (Vercel with CDN)
└─ Backend (Container service with autoscaling)
```

---

This architecture enables:
- ✅ Scalable async processing
- ✅ Resilient error handling
- ✅ Complete audit trails
- ✅ Optional third-party integrations
- ✅ Easy local development
