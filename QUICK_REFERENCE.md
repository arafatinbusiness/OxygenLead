# OxygenLead - Quick Reference

## 🚀 Get Started in 2 Minutes

```bash
# 1. Run setup (one time)
./setup.sh

# 2. Start app
pnpm dev

# 3. Open browser
http://localhost:3000

# 4. Login
Email: demo@oxygenlead.com
Password: password123
```

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| **README** | Overview and architecture |
| **SETUP_GUIDE.md** | Complete setup instructions |
| **TESTING_GUIDE.md** | How to test features |
| **IMPLEMENTATION_SUMMARY.md** | What was implemented |
| **This file** | Quick reference |

---

## 🛠️ Common Commands

### Development
```bash
pnpm dev              # Start frontend + backend
pnpm server           # Start backend only
pnpm next dev         # Start frontend only
```

### Database
```bash
pnpm db:push          # Create/update schema
pnpm db:seed          # Add test data
pnpm db:migrate       # Create migration
pnpm db:studio        # Open database GUI
```

### Docker
```bash
docker-compose up -d  # Start containers
docker-compose down   # Stop containers
docker-compose logs   # View logs
docker-compose ps     # Check status
```

---

## 📍 Ports & URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | Next.js app |
| Backend | http://localhost:3001 | Express API |
| Database | localhost:5432 | PostgreSQL |
| Redis | localhost:6379 | Queue system |
| DB Studio | http://localhost:5555 | Prisma GUI |

---

## 🔑 Demo Credentials

```
Email:    demo@oxygenlead.com
Password: password123
```

---

## 📊 What's Included

- ✅ 5 test stores (Brightland, Glossier, Allbirds, Warby Parker, Shopify)
- ✅ 7 founders with roles
- ✅ 7 social media accounts
- ✅ Complete activity history
- ✅ Pre-calculated lead scores

---

## 🔍 Key Features Implemented

### Option 1: Database & Local Setup ✅
- Docker PostgreSQL + Redis setup
- Automated one-command initialization
- Pre-seeded test data
- Setup documentation

### Option 2: Enhanced Backend ✅
- Shopify detection (patterns)
- E-commerce detection (indicators)
- Founder extraction (patterns + OpenAI fallback)
- Smart queue processing
- Error handling & history logging

---

## 🚨 Troubleshooting

### "Docker not found"
Install Docker: https://docs.docker.com/get-docker/

### "Port 5432 in use"
```bash
docker-compose down
# Then try again
```

### "pnpm db:push fails"
```bash
# Wait for postgres to be ready
docker-compose ps

# Check postgres is healthy
docker-compose logs postgres
```

### "Login fails"
- Ensure database seeded: `pnpm db:seed`
- Check PostgreSQL is running: `docker-compose ps`

---

## 📖 Testing Workflow

1. **Add Store**: Click "Add Store" button
2. **Enter URL**: `https://www.allbirds.com`
3. **Analyze**: Click "Analyze" button
4. **Wait**: 5-10 seconds for scraping
5. **View**: Store appears in grid with:
   - Shopify badge ✓
   - Founders extracted ✓
   - Social accounts ✓
   - Lead score calculated ✓

---

## 🔗 API Examples

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@oxygenlead.com",
    "password": "password123"
  }'
```

### Get Stores
```bash
curl http://localhost:3001/api/stores \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Add Store
```bash
curl -X POST http://localhost:3001/api/stores \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

---

## 💾 Database Tables

```
User              → Stores (1:many)
Store             → Founders (1:many)
Store             → Contacts (1:many)
Store             → SocialAccounts (1:many)
Store             → LinkedinMatches (1:many)
Store             → JobListings (1:many)
Store             → History (1:many)
Store             → QueueJobs (1:many)
```

---

## 🎯 Environment Variables

```env
# Database
DATABASE_URL=postgresql://oxygenlead:...@localhost:5432/oxygenlead

# Server
PORT=3001
NODE_ENV=development

# Auth
JWT_SECRET=oxygenlead-dev-secret-...

# Queue
REDIS_URL=redis://localhost:6379

# Optional APIs
OPENAI_API_KEY=            (leave blank to skip)
SHOPIFY_API_KEY=           (leave blank to skip)
```

---

## 📈 Next Steps

After setup works:

1. **Add more stores**: Use the dashboard
2. **Test APIs**: Try curl examples
3. **Check database**: Run `pnpm db:studio`
4. **Enable OpenAI**: Add OPENAI_API_KEY to .env.local
5. **Deploy**: Follow production checklist in SETUP_GUIDE.md

---

## ✅ Checklist Before First Run

- [ ] Docker installed
- [ ] Node.js 18+ installed
- [ ] pnpm installed
- [ ] Ran `./setup.sh`
- [ ] No port conflicts (3000, 3001, 5432, 6379)
- [ ] 5-10 minutes for complete setup

---

## 🆘 Need Help?

1. Check **SETUP_GUIDE.md** for detailed setup
2. Check **TESTING_GUIDE.md** for manual testing steps
3. Check **IMPLEMENTATION_SUMMARY.md** for what was built
4. Check docker logs: `docker-compose logs postgres`
5. Check database: `pnpm db:studio`

---

**Ready to use OxygenLead? Run `./setup.sh` and `pnpm dev`!**
