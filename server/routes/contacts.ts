import { Router, Response } from "express";
import prisma from "../utils/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();


// Get contacts for a store
router.get("/:storeId", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const store = await prisma.store.findFirst({
      where: { id: req.params.storeId, userId: req.userId },
    });

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const contacts = await prisma.contact.findMany({
      where: { storeId: req.params.storeId },
    });

    res.json(contacts);
  } catch (error) {
    console.error("[v0] Get contacts error:", error);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

export default router;
