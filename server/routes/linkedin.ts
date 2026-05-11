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

    const matches = await prisma.linkedinMatch.findMany({
      where: { storeId: req.params.storeId },
    });

    res.json(matches);
  } catch (error) {
    console.error("[v0] Get LinkedIn matches error:", error);
    res.status(500).json({ error: "Failed to fetch LinkedIn matches" });
  }
});

export default router;
