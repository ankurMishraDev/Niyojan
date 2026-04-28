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
	registration_id: z.string().min(2).max(120).optional(),
	contact_phone: z.string().min(6).max(40).optional(),
	website: z.string().url().max(255).optional(),
	address_text: z.string().min(5).max(500).optional(),
	focus_areas: z.array(z.string().min(2).max(80)).max(12).default([]),
	operating_regions: z.array(z.string().min(2).max(120)).max(12).default([]),
	team_size: z.coerce.number().int().positive().max(100000).optional(),
	founded_year: z.coerce.number().int().min(1800).max(new Date().getFullYear()).optional(),
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
