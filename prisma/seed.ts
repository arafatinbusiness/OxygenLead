import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("🌱 Seeding database...");

  // Create test user
  const hashedPassword = await bcrypt.hash("password123", 10);
  
  const user = await prisma.user.upsert({
    where: { email: "demo@oxygenlead.com" },
    update: {},
    create: {
      email: "demo@oxygenlead.com",
      password: hashedPassword,
    },
  });

  console.log("✅ Created user:", user.email);

  // Create test stores
  const storesData = [
    {
      url: "https://www.brightland.com",
      domain: "brightland.com",
      storeName: "Brightland",
      storeType: "food",
      estimatedMonthlyRevenue: 500000,
      foundersCount: 1,
    },
    {
      url: "https://www.glossier.com",
      domain: "glossier.com",
      storeName: "Glossier",
      storeType: "beauty",
      estimatedMonthlyRevenue: 5000000,
      foundersCount: 1,
    },
    {
      url: "https://www.allbirds.com",
      domain: "allbirds.com",
      storeName: "Allbirds",
      storeType: "fashion",
      estimatedMonthlyRevenue: 3000000,
      foundersCount: 2,
    },
    {
      url: "https://www.warbyparker.com",
      domain: "warbyparker.com",
      storeName: "Warby Parker",
      storeType: "fashion",
      estimatedMonthlyRevenue: 4000000,
      foundersCount: 2,
    },
  ];

  const stores = [];
  for (const storeData of storesData) {
    const store = await prisma.store.upsert({
      where: { url: storeData.url },
      update: {},
      create: {
        userId: user.id,
        url: storeData.url,
        domain: storeData.domain,
        storeName: storeData.storeName,
        storeType: storeData.storeType,
        estimatedMonthlyRevenue: storeData.estimatedMonthlyRevenue,
        foundersCount: storeData.foundersCount,
        leadScore: Math.floor(Math.random() * 100),
        leadScoreCalculatedAt: new Date(),
      },
    });
    stores.push(store);
    console.log("✅ Created store:", store.storeName);
  }

  // Create test founders
  const founderData = [
    { storeId: stores[0].id, name: "Doug Psaltis", role: "Founder" },
    { storeId: stores[1].id, name: "Emily Weiss", role: "Founder & CEO" },
    { storeId: stores[2].id, name: "Tim Brown", role: "Co-Founder & CEO" },
    { storeId: stores[2].id, name: "Joey Zwillinger", role: "Co-Founder & CEO" },
    { storeId: stores[3].id, name: "Neil Blumenthal", role: "Co-Founder & Co-CEO" },
    { storeId: stores[3].id, name: "Dave Gilboa", role: "Co-Founder & Co-CEO" },
  ];

  for (const data of founderData) {
    const founder = await prisma.founder.create({
      data: {
        storeId: data.storeId,
        name: data.name,
        role: data.role,
      },
    });
    console.log(`✅ Created founder: ${founder.name}`);
  }

  // Create test social accounts
  const socialData = [
    { storeId: stores[0].id, platform: "instagram", handle: "brightland", url: "https://instagram.com/brightland" },
    { storeId: stores[1].id, platform: "instagram", handle: "glossier", url: "https://instagram.com/glossier" },
    { storeId: stores[1].id, platform: "twitter", handle: "glossier", url: "https://twitter.com/glossier" },
    { storeId: stores[2].id, platform: "instagram", handle: "allbirds", url: "https://instagram.com/allbirds" },
    { storeId: stores[2].id, platform: "twitter", handle: "allbirds", url: "https://twitter.com/allbirds" },
    { storeId: stores[3].id, platform: "instagram", handle: "warbyparker", url: "https://instagram.com/warbyparker" },
    { storeId: stores[3].id, platform: "twitter", handle: "warbyparker", url: "https://twitter.com/warbyparker" },
  ];

  for (const data of socialData) {
    const social = await prisma.socialAccount.create({
      data: {
        storeId: data.storeId,
        platform: data.platform,
        handle: data.handle,
        url: data.url,
      },
    });
    console.log(`✅ Created social: ${data.platform}/${data.handle}`);
  }

  // Create some history entries
  for (const store of stores) {
    await prisma.storeHistory.create({
      data: {
        storeId: store.id,
        action: "store_created",
        details: JSON.stringify({ source: "seed_script" }),
      },
    });
  }

  console.log("✅ Seeding completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
