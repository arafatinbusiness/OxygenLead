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

    const history = await prisma.storeHistory.findMany({
      where: { storeId: req.params.storeId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json(history);
  } catch (error) {
    console.error("[v0] Get history error:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

export default router;
