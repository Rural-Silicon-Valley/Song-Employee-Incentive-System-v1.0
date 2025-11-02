import { Router } from "express";
import { submitInactivityReportController, adminListInactivityReportsController, adminResolveInactivityReportController } from "../controllers/inboxController.js";
import { isAdmin } from "../middleware/auth.js";

export const inboxRouter = Router();

// 用户提交未使用原因
inboxRouter.post("/report", submitInactivityReportController);

// 管理员收件箱
inboxRouter.get("/admin", isAdmin, adminListInactivityReportsController);
inboxRouter.post("/admin/resolve", isAdmin, adminResolveInactivityReportController);
