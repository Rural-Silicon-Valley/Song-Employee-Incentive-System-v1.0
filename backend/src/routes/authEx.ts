import { Router } from "express";
import { requestOtpController, verifyOtpController, issueTokenController, registerWithTokenController, loginWithTokenController } from "../controllers/authExController.js";

export const authExRouter = Router();

authExRouter.post("/request-otp", requestOtpController);
authExRouter.post("/verify-otp", verifyOtpController);
authExRouter.post("/issue-token", issueTokenController);
authExRouter.post("/register-with-token", registerWithTokenController);
authExRouter.post("/login-with-token", loginWithTokenController);
