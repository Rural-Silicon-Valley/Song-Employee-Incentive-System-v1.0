import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Roles } from "../types/roles.js";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
  };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "未提供身份令牌" });
  }

  const token = authHeader.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: number; role: string };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "身份令牌无效或已过期" });
  }
}

export function requireRole(role: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "未登录" });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ message: "权限不足" });
    }

    next();
  };
}

export const isAdmin = requireRole(Roles.ADMIN);
