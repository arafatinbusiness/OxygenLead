# OxygenLead - B2B Lead Research Platform

A full-stack application for researching, analyzing, and scoring e-commerce leads with founder intelligence, social insights, and business maturity scoring.

## 🚀 Quick Start (Local Development)

```bash
# One-command setup - installs everything and seeds test data
./setup.sh

# Start the application
pnpm dev
```

Then open http://localhost:3000 and login with:
- Email: `demo@oxygenlead.com`
- Password: `password123`

## 🏗️ Architecture

- **Frontend**: Next.js 16 with shadcn/ui components
- **Backend**: Express.js REST API
- **Database**: PostgreSQL
- **Queue**: Redis + Bull
- **Scraping**: Playwright + Cheerio

## 📦 Deployment

### Prerequisites
1. A **Supabase** account (free) for PostgreSQL database
2. A **Render** account (free) for the backend API
3. A **Vercel** account (free) for the frontend

### Environment Variables

Copy `.env.example` to a new file and fill in the values:

```bash
cp .env.example .env.production
```

### Deploy to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:YOUR_USERNAME/OxygenLead.git
git push -u origin main
```

### Deploy Backend to Render
1. Go to https://render.com → New → Web Service
2. Connect your GitHub repo
3. Set:
   - **Build Command**: `pnpm install && npx prisma generate`
   - **Start Command**: `npx tsx server/index.ts`
4. Add environment variables from your `.env.production`

### Deploy Frontend to Vercel
1. Go to https://vercel.com → Add New → Project
2. Import your GitHub repo
3. Set environment variable: `NEXT_PUBLIC_API_URL` = your Render backend URL

## 📄 License

MIT
