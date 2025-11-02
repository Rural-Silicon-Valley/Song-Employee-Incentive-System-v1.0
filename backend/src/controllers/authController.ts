import { Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { env } from "../config/env.js";
import { Roles } from "../types/roles.js";
import { registerSchema, loginSchema } from "../validators/authSchemas.js";

const createToken = (userId: number, role: string) => {
  const options: SignOptions = {
    expiresIn: (env.TOKEN_EXPIRES_IN ?? "1d") as SignOptions["expiresIn"],
  };
  return jwt.sign({ id: userId, role }, env.JWT_SECRET, options);
};

export async function register(req: Request, res: Response) {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: "输入格式错误", errors: parseResult.error.flatten() });
  }

  const { email, password, displayName, signature } = parseResult.data;

  if (!email || !password || !displayName) {
    return res.status(400).json({ message: "缺少必要字段" });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ message: "邮箱已存在" });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName,
      signature,
      role: Roles.EMPLOYEE,
      pointsAccount: {
        create: {},
      },
    },
  });

  const token = createToken(user.id, user.role);
  return res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      signature: user.signature,
    },
  });
}

export async function login(req: Request, res: Response) {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: "输入格式错误", errors: parseResult.error.flatten() });
  }

  const { email, password } = parseResult.data;

  const user = await prisma.user.findUnique({ where: { email }, include: { pointsAccount: true } });
  if (!user) {
    return res.status(401).json({ message: "账号或密码错误" });
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "账号或密码错误" });
  }

  const token = createToken(user.id, user.role);
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      signature: user.signature,
      points: user.pointsAccount?.currentPoints ?? 0,
    },
  });
}
