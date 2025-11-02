import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getProfile, updateProfile, getPointHistory } from "../controllers/userController.js";

export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.get("/me", getProfile);
userRouter.put("/me", updateProfile);
userRouter.get("/points", getPointHistory);
