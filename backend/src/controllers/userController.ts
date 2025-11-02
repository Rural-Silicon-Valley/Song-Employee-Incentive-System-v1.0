import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AuthRequest } from "../middleware/auth.js";
import { z } from "zod";

const updateProfileSchema = z.object({
  displayName: z.string().min(1),
  signature: z.string().optional(),
});

export async function getProfile(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "未登录" });

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      pointsAccount: true,
    },
  });

  if (!user) {
    return res.status(404).json({ message: "用户不存在" });
  }

  return res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    signature: user.signature,
    role: user.role,
    points: user.pointsAccount?.currentPoints ?? 0,
  });
}

export async function updateProfile(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "未登录" });

  const parseResult = updateProfileSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: "输入格式不正确", errors: parseResult.error.flatten() });
  }

  const { displayName, signature } = parseResult.data;

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      displayName,
      signature,
    },
  });

  return res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    signature: user.signature,
    role: user.role,
  });
}

export async function getPointHistory(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "未登录" });

  const logs = await prisma.pointTransaction.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return res.json(logs);
}
