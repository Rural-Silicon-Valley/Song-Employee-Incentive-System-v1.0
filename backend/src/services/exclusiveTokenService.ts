import { prisma } from "../lib/prisma.js";

function genToken(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const year = new Date().getFullYear();
  const prefix = process.env.TOKEN_PREFIX || "GV";
  return `${prefix}-${year}-${rand}`;
}

export async function issueExclusiveToken(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { ok: false as const, reason: "USER_NOT_FOUND" };
  if (user.exclusiveToken) return { ok: true as const, token: user.exclusiveToken };
  const token = genToken();
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { exclusiveToken: token, tokenIssuedAt: new Date() },
  });
  return { ok: true as const, token: updated.exclusiveToken! };
}
