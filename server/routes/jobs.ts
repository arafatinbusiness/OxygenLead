import { Router, Response } from "express";
import prisma from "../utils/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();


router.get("/:storeId", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const store = await prisma.store.findFirst({
      where: { id: req.params.storeId, userId: req.userId },
    });

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const jobs = await prisma.jobListing.findMany({
      where: { storeId: req.params.storeId },
    });

    res.json(jobs);
  } catch (error) {
    console.error("[v0] Get job listings error:", error);
    res.status(500).json({ error: "Failed to fetch job listings" });
  }
});

export default router;
