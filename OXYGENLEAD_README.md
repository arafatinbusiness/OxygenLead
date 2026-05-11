# OxygenLead - B2B Lead Research Platform

A full-stack application for researching, analyzing, and scoring e-commerce leads with founder intelligence, social insights, and business maturity scoring.

## 🚀 Quick Start (5 minutes with Docker)

```bash
# One-command setup - installs everything and seeds test data
./setup.sh

# Start the application
pnpm dev
```

Then open http://localhost:3000 and login with:
- Email: `demo@oxygenlead.com`
- Password: `password123`

**See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed instructions and [TESTING_GUIDE.md](./TESTING_GUIDE.md) for testing workflow.**

## Architecture Overview

### Frontend (Next.js)
- Modern dashboard with store management
- Authentication system
- Lead scoring visualization
- Responsive UI with shadcn/ui components

### Backend (Express.js)
- RESTful API with authentication
- PostgreSQL database with Prisma ORM
- Asynchronous job queue (BullMQ + Redis)
- Scraping and data enrichment services
- AI-powered founder extraction (OpenAI)

### Queue System
- **crawl-store**: Website scraping and data extraction
- **ai-enrich-founder**: Extract founder information using OpenAI
- **search-linkedin**: Find LinkedIn profiles for founders
- **score-lead**: Calculate comprehensive lead scores

## Project Structure

```
.
├── app/                          # Next.js frontend
│   ├── layout.tsx               # Root layout
│   ├── globals.css              # Tailwind + theme tokens
│   └── page.tsx                 # Main auth/dashboard router
├── components/                   # React components
│   ├── auth/                    # Authentication UI
│   └── dashboard/               # Dashboard components
├── server/                       # Express backend
│   ├── index.ts                 # Main server
│   ├── middleware/              # Auth middleware
│   ├── routes/                  # API endpoints
│   ├── services/                # Business logic
│   │   ├── scraper.ts          # Web scraping
│   │   ├── enrichment.ts       # AI enrichment
│   │   ├── scoring.ts          # Lead scoring
│   │   └── linkedin.ts         # LinkedIn search
│   ├── queue/                   # Job queue
│   └── utils/                   # Helpers
├── prisma/
│   └── schema.prisma            # Database schema
├── .env.local                   # Environment variables
└── package.json                 # Dependencies
```

## Getting Started

## ✨ Latest Enhancements (Implemented)

### 1. Docker Integration
- Pre-configured `docker-compose.yml` for PostgreSQL + Redis
- One-command startup: `docker-compose up -d`
- Automatic health checks and retry logic

### 2. Enhanced Scraping Service
- **Shopify Detection**: Detects Shopify stores via patterns (CDN, headers, script tags)
- **E-commerce Indicators**: Identifies e-commerce sites by analyzing content for product/checkout keywords
- **Better Data Extraction**: Improved social media link parsing

### 3. Smart Enrichment Service
- **Fallback to Pattern-Based Extraction**: Works without OpenAI API
- **Intelligent Founder Detection**: Regex patterns extract founders even without AI
- **Graceful Degradation**: Automatically uses patterns if OpenAI key not set
- **Optional AI Enrichment**: Adds AI extraction when `OPENAI_API_KEY` is available

### 4. Database Seeding
- Pre-built seed script with 5 real stores (Brightland, Glossier, Allbirds, etc.)
- 7 founders with realistic roles and bios
- 7 social media accounts
- Demo user ready to use

### 5. Comprehensive Documentation
- **SETUP_GUIDE.md**: Complete step-by-step setup with troubleshooting
- **TESTING_GUIDE.md**: Manual and automated testing workflows
- **setup.sh**: Automated setup script for one-command initialization

### Prerequisites
- Docker & Docker Compose (recommended)
- Node.js 18+
- pnpm

### 1. Automated Setup (Recommended)

```bash
# Run the automated setup script (Linux/Mac)
./setup.sh

# Or manually:
# Start Docker containers
docker-compose up -d

# Install dependencies
pnpm install

# Initialize database
pnpm db:push

# Seed test data
pnpm db:seed
```

### 2. Environment Configuration

The `.env.local` file is pre-configured for Docker. Key settings:

```env
# Database (Docker PostgreSQL)
DATABASE_URL="postgresql://oxygenlead:oxygenlead_dev_password_123@localhost:5432/oxygenlead"

# Server
PORT=3001
NODE_ENV="development"

# JWT
JWT_SECRET="oxygenlead-dev-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"

# Redis (Docker Redis)
REDIS_URL="redis://localhost:6379"

# Optional: Add OpenAI for enhanced founder extraction
OPENAI_API_KEY=""  # Leave empty to use pattern-based extraction
```

### 3. Start Development

```bash
# Starts both Next.js (port 3000) and Express (port 3001)
pnpm dev

# Access the app:
# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
# Database UI: pnpm db:studio
```

The app will be available at `http://localhost:3000` (Next.js) and backend at `http://localhost:3001` (Express).

## Core Features

### Authentication
- Email/password registration and login
- JWT token-based authentication
- Secure session management

### Store Management
- Add stores by URL
- Track store metadata
- View store details and history
- Delete stores

### Data Collection
- **Scraping**: Extract store information, links, and social accounts
- **Enrichment**: AI-powered extraction of founder information
- **LinkedIn Search**: Find LinkedIn profiles for founders
- **Job Tracking**: Monitor job postings as growth indicator

### Lead Scoring Algorithm
Composite score (0-100) based on:
- **Founder Visibility** (25 pts): Number of founders + bios
- **Branding Quality** (20 pts): Professional naming
- **Business Maturity** (20 pts): Job postings + LinkedIn presence
- **Social Activity** (15 pts): Number of social accounts
- **Custom Domain** (10 pts): Own domain vs marketplace
- **LinkedIn Presence** (10 pts): Company LinkedIn profile

Score Interpretation:
- **Hot (80+)**: High-quality lead with strong indicators
- **Warm (60-79)**: Good potential with positive signals
- **Lukewarm (40-59)**: Some indicators but needs research
- **Cold (<40)**: Limited information or negative signals

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login

### Stores
- `GET /api/stores` - List user's stores (paginated)
- `POST /api/stores` - Add new store
- `GET /api/stores/:id` - Get store details
- `DELETE /api/stores/:id` - Delete store

### Related Data
- `GET /api/contacts/:storeId` - Store contacts
- `GET /api/founders/:storeId` - Store founders
- `GET /api/social/:storeId` - Social accounts
- `GET /api/linkedin/:storeId` - LinkedIn matches
- `GET /api/jobs/:storeId` - Job listings
- `GET /api/history/:storeId` - Activity history

## Database Schema

### Core Tables
- **User**: Authentication and profile
- **Store**: Store information and scoring
- **Contact**: Store contacts/team members
- **Founder**: Founder/leadership information
- **SocialAccount**: Social media profiles
- **LinkedinMatch**: LinkedIn profile matches
- **JobListing**: Job postings
- **StoreHistory**: Audit trail of changes
- **QueueJob**: Async job tracking

## Queue System

Jobs are processed asynchronously with:
- Exponential backoff retry (3 attempts)
- Automatic failure tracking
- Historical logging
- Dead letter queue for failed jobs

Monitor queue status in database:
```sql
SELECT type, status, COUNT(*) as count FROM "QueueJob" GROUP BY type, status;
```

## Development Tips

### Database
```bash
# Open Prisma Studio
pnpm db:studio

# Create migration
pnpm db:migrate

# Reset database
pnpm db:reset
```

### Debugging
- Backend logs appear in server terminal
- Frontend logs in browser console
- Database events in Prisma Studio
- Queue jobs tracked in database

### Testing Authentication
Demo account is shown on login page for quick testing.

## Production Deployment

1. Set `NODE_ENV="production"`
2. Use strong `JWT_SECRET`
3. Configure PostgreSQL with proper backups
4. Setup Redis with persistence
5. Add OpenAI API key
6. Deploy with `pnpm build && pnpm start`

## Future Enhancements

- LinkedIn OAuth integration
- Advanced filtering and search
- Bulk import from CSV
- Email notifications
- Custom scoring rules
- API for external integrations
- Advanced analytics dashboard

## Troubleshooting

### Port already in use
```bash
# Change port in .env.local
PORT=3002
```

### Redis connection failed
```bash
# Start Redis
redis-server

# Or use Docker
docker run -d -p 6379:6379 redis:latest
```

### Database connection failed
```bash
# Verify PostgreSQL is running and database exists
psql -l | grep oxygenlead

# Check DATABASE_URL in .env.local
```

## License

MIT
