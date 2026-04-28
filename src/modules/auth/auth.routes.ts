import { Router } from "express";
import { z } from "zod";
import { requireAuth, resolveAppUser } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { authController } from "./auth.controller";

const authRouter = Router();

const registerNgoBodySchema = z.object({
	organization_name: z.string().min(2).max(255),
	organization_type: z.string().min(2).max(100).default("NGO"),
	region: z.string().min(2).max(120).optional(),
	admin_name: z.string().min(2).max(255).optional(),
});

authRouter.get(
	"/me",
	requireAuth,
	resolveAppUser({
		allowMissing: true,
		allowStatuses: ["pending", "active", "rejected", "inactive"],
	}),
	authController.me,
);

authRouter.post(
	"/register-ngo",
	requireAuth,
	resolveAppUser({ allowMissing: true, allowStatuses: ["pending", "active", "rejected", "inactive"] }),
	validate({ body: registerNgoBodySchema }),
	authController.registerNgo,
);

export default authRouter;
