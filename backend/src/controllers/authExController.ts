import { Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { requestOtpSchema, verifyOtpSchema, issueTokenSchema, registerWithTokenSchema, loginWithTokenSchema } from "../validators/authSchemas.js";
import { requestOtp, verifyOtp } from "../services/otpService.js";
import { startOfMonth, endOfMonth } from "date-fns";

const createToken = (userId: number, role: string) => {
  const options: SignOptions = {
    expiresIn: (env.TOKEN_EXPIRES_IN ?? "1d") as SignOptions["expiresIn"],
  };
  return jwt.sign({ id: userId, role }, env.JWT_SECRET, options);
};

export async function requestOtpController(req: Request, res: Response) {
  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "输入错误", errors: parsed.error.flatten() });
  await requestOtp(parsed.data.email);
  return res.json({ ok: true });
}

export async function verifyOtpController(req: Request, res: Response) {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "输入错误", errors: parsed.error.flatten() });
  const result = await verifyOtp(parsed.data.email, parsed.data.code);
  if (!result.ok) return res.status(400).json({ ok: false, reason: result.reason });
  await prisma.user.updateMany({ where: { email: parsed.data.email }, data: { emailVerifiedAt: new Date() } });
  return res.json({ ok: true });
}

export async function issueTokenController(req: Request, res: Response) {
  const parsed = issueTokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "输入错误", errors: parsed.error.flatten() });
  const email = parsed.data.email;
  
  // 允许邮箱未注册先占用令牌：若用户不存在，先创建占位用户，后续完成密码与姓名设置
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email, passwordHash: await hashPassword("temp-" + Math.random().toString(36).slice(2,10)), displayName: email.split("@")[0], role: "EMPLOYEE" } });
  }

  if (!user.emailVerifiedAt) {
    return res.status(400).json({ message: "邮箱未验证，请先完成验证码验证" });
  }

  if (!user.exclusiveToken) {
    // 月度限额：每邮箱每月最多 3 次新发放
    const now = new Date();
    const from = startOfMonth(now);
    const to = endOfMonth(now);
  const issuedCount = await (prisma as any).tokenIssue.count({ where: { email, issuedAt: { gte: from, lte: to } } });
    if (issuedCount >= 3) {
      return res.status(429).json({ message: "本月令牌发放已达上限(3次)" });
    }
    const token = `${process.env.TOKEN_PREFIX || "GV"}-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    user = await prisma.user.update({ where: { id: user.id }, data: { exclusiveToken: token, tokenIssuedAt: new Date() } });
  await (prisma as any).tokenIssue.create({ data: { email } });
  }

  return res.json({ ok: true, token: user.exclusiveToken });
}

export async function registerWithTokenController(req: Request, res: Response) {
  const parsed = registerWithTokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "输入错误", errors: parsed.error.flatten() });
  const { email, code, token, name, password } = parsed.data;

  const otp = await verifyOtp(email, code);
  if (!otp.ok) return res.status(400).json({ message: "验证码无效或过期" });

  let user = await prisma.user.findUnique({ where: { email }, include: { pointsAccount: true } });
  if (!user) {
    const created = await prisma.user.create({ data: { email, passwordHash: await hashPassword(password), displayName: name, role: "EMPLOYEE", emailVerifiedAt: new Date(), exclusiveToken: token, tokenIssuedAt: new Date() } });
    await prisma.pointsAccount.create({ data: { userId: created.id } });
    user = await prisma.user.findUnique({ where: { id: created.id }, include: { pointsAccount: true } });
  } else {
    const u: any = user as any;
    if (u.tokenDisabledAt) {
      return res.status(403).json({ message: "令牌已被禁用，请提交未使用原因或联系管理员", disabledAt: u.tokenDisabledAt, reason: u.tokenDisabledReason || undefined });
    }
    // 若存在占位用户，则完善信息
    if (user.exclusiveToken && user.exclusiveToken !== token) return res.status(400).json({ message: "令牌不匹配" });
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), displayName: name, emailVerifiedAt: new Date(), exclusiveToken: token, tokenIssuedAt: user.tokenIssuedAt ?? new Date() } });
    if (!user.pointsAccount) {
      await prisma.pointsAccount.create({ data: { userId: user.id } });
    }
    user = await prisma.user.findUnique({ where: { id: user.id }, include: { pointsAccount: true } });
  }

  if (!user) return res.status(500).json({ message: "用户信息生成失败" });
  const jwtToken = createToken(user.id, user.role);
  return res.status(201).json({ token: jwtToken, user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } });
}

export async function loginWithTokenController(req: Request, res: Response) {
  const parsed = loginWithTokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "输入错误", errors: parsed.error.flatten() });
  const { email, password, token } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email }, include: { pointsAccount: true } });
  if (!user || !user.exclusiveToken || user.exclusiveToken !== token) return res.status(401).json({ message: "账号或令牌错误" });

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) return res.status(401).json({ message: "账号或密码错误" });

  const u: any = user as any;
  if (u.tokenDisabledAt) {
    return res.status(403).json({ message: "令牌已被禁用", disabledAt: u.tokenDisabledAt, reason: u.tokenDisabledReason || undefined });
  }

  const jwtToken = createToken(user.id, user.role);
  return res.json({ token: jwtToken, user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, points: user.pointsAccount?.currentPoints ?? 0 } });
}
