# OxygenLead Setup Guide

Complete guide to get OxygenLead running locally with Docker.

## Prerequisites

- Docker & Docker Compose (https://docs.docker.com/get-docker/)
- Node.js 18+ (https://nodejs.org/)
- pnpm (`npm install -g pnpm`)

## Quick Start (5 minutes)

### 1. Start Docker containers

```bash
docker-compose up -d
```

This starts:
- PostgreSQL database on `localhost:5432`
- Redis cache on `localhost:6379`

Verify they're running:
```bash
docker-compose ps
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Initialize database

```bash
pnpm db:push
```

This creates all tables from the Prisma schema.

### 4. Seed with test data

```bash
pnpm db:seed
```

This populates the database with:
- 1 demo user (email: `demo@oxygenlead.com`, password: `password123`)
- 5 test stores (Brightland, Glossier, Shopify, Allbirds, Warby Parker)
- 7 founders with roles
- 7 social media accounts

### 5. Start the application

```bash
pnpm dev
```

This starts:
- Next.js frontend on `http://localhost:3000`
- Express backend on `http://localhost:3001`

Both will auto-reload on file changes.

## Accessing the App

1. **Frontend**: http://localhost:3000
2. **Backend API**: http://localhost:3001
3. **Database Studio**: `pnpm db:studio` (opens Prisma Studio GUI)
4. **Redis CLI**: `docker exec oxygenlead-redis redis-cli`

## Testing the Flow

### Manual Flow Test

1. Open http://localhost:3000
2. Click "Sign up"
3. Create account with any email/password
4. Click "Add Store"
5. Enter store URL (e.g., `https://www.brightland.com`)
6. Click "Analyze"

### What Happens Behind the Scenes

1. **Scraping**: Fetches HTML from store URL
2. **Detection**: Checks if Shopify + E-commerce
3. **Enrichment**: Extracts founders from content (uses patterns by default)
4. **Queue Jobs**: Enqueues LinkedIn search and scoring jobs
5. **Scoring**: Calculates lead score (0-100)

### Monitoring Queue Jobs

```bash
docker exec oxygenlead-redis redis-cli
> KEYS *
> HGETALL bull:job:*
```

## Database Commands

```bash
# View database in GUI
pnpm db:studio

# Create a new migration
pnpm db:migrate

# View current schema
cat prisma/schema.prisma

# Access PostgreSQL CLI
docker exec -it oxygenlead-postgres psql -U oxygenlead -d oxygenlead
```

## Environment Variables

The `.env.local` file is pre-configured for Docker. Key variables:

```
DATABASE_URL=postgresql://oxygenlead:oxygenlead_dev_password_123@localhost:5432/oxygenlead
REDIS_URL=redis://localhost:6379
PORT=3001
JWT_SECRET=oxygenlead-dev-secret-key-change-in-production
```

To add OpenAI enrichment later:
```
OPENAI_API_KEY=sk-your-key-here
```

## Troubleshooting

### "Cannot connect to postgres"
```bash
# Check if containers are running
docker-compose ps

# View logs
docker-compose logs postgres
```

### "Port 5432 already in use"
```bash
# Stop existing containers
docker-compose down

# Or use different port in docker-compose.yml
```

### "pnpm db:push fails"
```bash
# Ensure database is ready (wait ~5s after docker-compose up)
docker-compose ps  # Check postgres is healthy

# Reset database
docker-compose down -v  # Remove volumes
docker-compose up -d    # Start fresh
```

### Seed script fails
```bash
# Make sure dependencies are installed
pnpm install

# Check Node version (need 18+)
node --version
```

## Next Steps

After setup is working:

1. **Add real Shopify detection**: Integrate Shopify API for store validation
2. **LinkedIn integration**: Connect LinkedIn API for founder matching
3. **OpenAI enrichment**: Add OPENAI_API_KEY to enable AI-powered extraction
4. **Email notifications**: Set up email alerts for hot leads
5. **Bulk import**: Add CSV import for store URLs

## Architecture

```
OxygenLead
├── Frontend (Next.js + React)
│   ├── Auth Page
│   ├── Dashboard
│   └── Store Details
│
├── Backend (Express.js)
│   ├── API Routes
│   │   ├── /auth (login, signup)
│   │   ├── /stores (CRUD)
│   │   ├── /founders
│   │   └── /history
│   │
│   ├── Services
│   │   ├── Scraper (Cheerio)
│   │   ├── Enrichment (AI optional)
│   │   ├── Scoring (Algorithm)
│   │   └── LinkedIn (Placeholder)
│   │
│   └── Queue (BullMQ + Redis)
│       ├── crawl-store
│       ├── ai-enrich-founder
│       ├── search-linkedin
│       └── score-lead
│
└── Database (PostgreSQL)
    ├── Users
    ├── Stores
    ├── Founders
    ├── Social Accounts
    ├── LinkedIn Matches
    ├── Job Listings
    ├── History
    └── Queue Jobs
```

## API Endpoints

### Auth
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

### Stores
- `GET /api/stores` - List user's stores
- `POST /api/stores` - Create new store
- `GET /api/stores/:id` - Get store details
- `DELETE /api/stores/:id` - Delete store

### Founders
- `GET /api/founders` - List founders
- `GET /api/founders?storeId=:id` - Founders for store

### History
- `GET /api/history?storeId=:id` - Activity log

## Performance Tips

1. Increase `MAX_CONCURRENT_BROWSERS` for faster scraping
2. Add Redis caching for frequently accessed stores
3. Use database indexes (already configured in schema)
4. Batch job processing with BullMQ

## Production Checklist

Before deploying:
- [ ] Change `JWT_SECRET` to secure random string
- [ ] Add `OPENAI_API_KEY` for AI enrichment
- [ ] Configure Shopify API credentials
- [ ] Set up email service for alerts
- [ ] Add CORS origins for frontend domain
- [ ] Enable database backups
- [ ] Set up monitoring/error tracking
