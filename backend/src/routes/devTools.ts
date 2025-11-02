import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requestOtp, verifyOtp } from "../services/otpService.js";
import { hashPassword } from "../utils/password.js";

export const devToolsRouter = Router();

// GET /api/dev/request-otp?email=foo@example.com
devToolsRouter.get("/request-otp", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim();
    if (!email) return res.status(400).json({ ok: false, message: "缺少 email" });
    await requestOtp(email);
    return res.json({ ok: true, email });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "发送失败" });
  }
});

// GET /api/dev/admins —— 列出所有管理员邮箱
devToolsRouter.get("/admins", async (_req, res) => {
  try {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true, email: true, displayName: true, role: true } });
    return res.json({ ok: true, admins });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "查询失败" });
  }
});

// GET /api/dev/make-admin?email=foo@example.com —— 将某邮箱设为管理员（本地开发用）
devToolsRouter.get("/make-admin", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim();
    if (!email) return res.status(400).json({ ok: false, message: "缺少 email" });
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: await hashPassword("admin-" + Math.random().toString(36).slice(2, 10)),
          displayName: email.split("@")[0],
          role: "ADMIN",
          emailVerifiedAt: new Date(),
        },
      });
    } else if (user.role !== "ADMIN") {
      user = await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    }
    return res.json({ ok: true, admin: { id: user.id, email: user.email, role: user.role } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "设置失败" });
  }
});

// GET /api/dev/demote-admin?email=foo@example.com —— 将管理员降级为员工（本地开发用）
devToolsRouter.get("/demote-admin", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim();
    if (!email) return res.status(400).json({ ok: false, message: "缺少 email" });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ ok: false, message: "用户不存在" });
    if (user.role === "ADMIN") {
      const updated = await prisma.user.update({ where: { id: user.id }, data: { role: "EMPLOYEE" } });
      return res.json({ ok: true, user: { id: updated.id, email: updated.email, role: updated.role } });
    }
    return res.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "降级失败" });
  }
});

// GET /api/dev/verify-otp?email=...&code=123456
devToolsRouter.get("/verify-otp", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim();
    const code = String(req.query.code || "").trim();
    if (!email || !code) return res.status(400).json({ ok: false, message: "缺少 email 或 code" });
    const result = await verifyOtp(email, code);
    if (!result.ok) return res.status(400).json({ ok: false, reason: result.reason });
    await prisma.user.updateMany({ where: { email }, data: { emailVerifiedAt: new Date() } });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "验证失败" });
  }
});

// GET /api/dev/issue-token?email=...
devToolsRouter.get("/issue-token", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim();
    if (!email) return res.status(400).json({ ok: false, message: "缺少 email" });

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: await hashPassword("temp-" + Math.random().toString(36).slice(2, 10)),
          displayName: email.split("@")[0],
          role: "EMPLOYEE",
          emailVerifiedAt: new Date(),
        },
      });
    }

    if (!user.emailVerifiedAt) {
      return res.status(400).json({ ok: false, message: "邮箱未验证，请先完成验证码验证" });
    }

    if (!user.exclusiveToken) {
      const token = `${process.env.TOKEN_PREFIX || "GV"}-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      user = await prisma.user.update({ where: { id: user.id }, data: { exclusiveToken: token, tokenIssuedAt: new Date() } });
    }

    return res.json({ ok: true, token: user.exclusiveToken });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "发令牌失败" });
  }
});

// GET /api/dev/logout-all  —— 本地开发用：通过旋转内存中的 JWT_SECRET 让现有令牌失效
devToolsRouter.get("/logout-all", async (_req, res) => {
  try {
    const newSecret = `rotated_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    process.env.JWT_SECRET = newSecret;
    return res.json({ ok: true, rotated: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "操作失败" });
  }
});

// GET /api/dev/reset-users-otps?confirm=yes —— 彻底重置用户表与验证码表（开发用途）
devToolsRouter.get("/reset-users-otps", async (req, res) => {
  try {
    const confirm = String(req.query.confirm || "");
    if (confirm !== "yes") {
      return res.status(400).json({ ok: false, message: "为避免误操作，请附带参数 ?confirm=yes" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 按外键依赖顺序删除
      const rTaskReview = await tx.taskReview.deleteMany({});
      const rWrong = await tx.wrongAnswer.deleteMany({});
      const rExamAnswer = await tx.examAnswer.deleteMany({});
      const rExamSession = await tx.examSession.deleteMany({});
      const rPointTxn = await tx.pointTransaction.deleteMany({});
      const rRewardReq = await tx.rewardRequest.deleteMany({});
      const rTaskSubmit = await tx.taskSubmission.deleteMany({});
      const rDaily = await (tx as any).dailyActivity.deleteMany({});
      const rInbox = await (tx as any).inactivityReport.deleteMany({});
      const rIssue = await (tx as any).tokenIssue.deleteMany({});
      const rPoints = await tx.pointsAccount.deleteMany({});
      const rDetachTasks = await tx.task.updateMany({ data: { createdById: null }, where: { createdById: { not: null } } });
      const rOtps = await tx.emailOtp.deleteMany({});
      const rUsers = await tx.user.deleteMany({});

      return {
        taskReview: rTaskReview.count,
        wrongAnswer: rWrong.count,
        examAnswer: rExamAnswer.count,
        examSession: rExamSession.count,
        pointTransaction: rPointTxn.count,
        rewardRequest: rRewardReq.count,
        taskSubmission: rTaskSubmit.count,
        pointsAccount: rPoints.count,
        dailyActivity: rDaily.count,
        inactivityReport: rInbox.count,
        tokenIssue: rIssue.count,
        tasksDetached: rDetachTasks.count,
        emailOtp: rOtps.count,
        users: rUsers.count,
      };
    });

    return res.json({ ok: true, cleared: result });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "重置失败" });
  }
});
