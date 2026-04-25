import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { authController } from "./auth.controller";

const authRouter = Router();

authRouter.get("/me", requireAuth, authController.me);

export default authRouter;
