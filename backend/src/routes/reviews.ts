import { Router } from "express";
import { requireAuth, isAdmin } from "../middleware/auth.js";
import { listPendingReviews, reviewSubmission } from "../controllers/reviewController.js";

export const reviewRouter = Router();

reviewRouter.use(requireAuth);
reviewRouter.get("/pending", isAdmin, listPendingReviews);
reviewRouter.post("/:submissionId", isAdmin, reviewSubmission);
