import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { submitInactivitySchema, inboxListSchema, inboxResolveSchema } from "../validators/inboxSchemas.js";

export async function submitInactivityReportController(req: Request, res: Response) {
  const parsed = submitInactivitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "输入错误", errors: parsed.error.flatten() });
  const { email, reason } = parsed.data;
  // 可选关联用户
  const user = await prisma.user.findUnique({ where: { email } });
  const created = await (prisma as any).inactivityReport.create({ data: { email, reason, userId: user?.id } });
  return res.status(201).json({ ok: true, id: created.id });
}

export async function adminListInactivityReportsController(req: Request, res: Response) {
  const parsed = inboxListSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "输入错误", errors: parsed.error.flatten() });
  const status = parsed.data.status;
  const items = await (prisma as any).inactivityReport.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
  });
  return res.json({ ok: true, items });
}

export async function adminResolveInactivityReportController(req: Request, res: Response) {
  const parsed = inboxResolveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "输入错误", errors: parsed.error.flatten() });
  const { id, note } = parsed.data;
  const exists = await (prisma as any).inactivityReport.findUnique({ where: { id } });
  if (!exists) return res.status(404).json({ message: "记录不存在" });
  const updated = await (prisma as any).inactivityReport.update({ where: { id }, data: { status: "RESOLVED", resolvedAt: new Date(), adminNote: note ?? null } });
  return res.json({ ok: true, id: updated.id });
}
