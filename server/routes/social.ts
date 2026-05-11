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

    const socialAccounts = await prisma.socialAccount.findMany({
      where: { storeId: req.params.storeId },
    });

    res.json(socialAccounts);
  } catch (error) {
    console.error("[v0] Get social accounts error:", error);
    res.status(500).json({ error: "Failed to fetch social accounts" });
  }
});

export default router;
