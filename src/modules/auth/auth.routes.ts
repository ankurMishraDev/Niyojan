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

const registerVolunteerBodySchema = z.object({
	org_id: z.string().uuid().optional(),
	volunteer_name: z.string().min(2).max(255).optional(),
	availability_status: z.string().min(2).max(50).default("available"),
	location_text: z.string().max(255).optional(),
	latitude: z.number().min(-90).max(90).optional(),
	longitude: z.number().min(-180).max(180).optional(),
	gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
	age: z.number().int().min(16).max(120).optional(),
	phone_number: z.string().min(6).max(40).optional(),
	profession: z.string().min(2).max(120).optional(),
	primary_domain: z.string().min(2).max(80).optional(),
	profile_summary: z.string().min(8).max(1000).optional(),
	skills: z.array(z.object({
		skill_id: z.string().uuid(),
		proficiency: z.number().int().min(1).max(5),
	})).max(12).default([]),
});

authRouter.get("/volunteer-onboarding-options", authController.volunteerOnboardingOptions);

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

authRouter.post(
	"/register-volunteer",
	requireAuth,
	resolveAppUser({ allowMissing: true, allowStatuses: ["pending", "active", "rejected", "inactive"] }),
	validate({ body: registerVolunteerBodySchema }),
	authController.registerVolunteer,
);

export default authRouter;
