import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import prisma from "./utils/prisma";
const app: Express = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("[v0] Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Import routes
import authRoutes from "./routes/auth";
import storeRoutes from "./routes/stores";
import contactRoutes from "./routes/contacts";
import founderRoutes from "./routes/founders";
import socialRoutes from "./routes/social";
import linkedinRoutes from "./routes/linkedin";
import jobRoutes from "./routes/jobs";
import historyRoutes from "./routes/history";
import reportRoutes from "./routes/report";

app.use("/api/auth", authRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/founders", founderRoutes);
app.use("/api/social", socialRoutes);
app.use("/api/linkedin", linkedinRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/report", reportRoutes);

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("[v0] Shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

const startServer = async () => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    console.log("[v0] Database connected successfully");

    app.listen(PORT, () => {
      console.log(`[v0] Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("[v0] Failed to start server:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();

export default app;
