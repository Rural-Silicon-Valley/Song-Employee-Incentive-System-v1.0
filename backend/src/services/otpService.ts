import { prisma } from "../lib/prisma.js";
import { addMinutes, isAfter } from "date-fns";
import { sendEmail } from "./mailService.js";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function requestOtp(email: string) {
  const code = generateCode();
  const expiresAt = addMinutes(new Date(), 5);
  await prisma.emailOtp.create({ data: { email, code, expiresAt } });
  await sendEmail(
    email,
    "你的登录验证码",
    `<p>验证码：<b>${code}</b>，5分钟内有效。</p>`
  );
  return { ok: true };
}

export async function verifyOtp(email: string, code: string) {
  const entry = await prisma.emailOtp.findFirst({
    where: { email, code, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!entry) return { ok: false, reason: "INVALID_CODE" } as const;
  if (isAfter(new Date(), entry.expiresAt)) return { ok: false, reason: "EXPIRED" } as const;
  await prisma.emailOtp.update({ where: { id: entry.id }, data: { consumedAt: new Date() } });
  return { ok: true } as const;
}
