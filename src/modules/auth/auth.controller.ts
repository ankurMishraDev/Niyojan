import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { authService } from "./auth.service";

class AuthController {
	me = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (req.user) {
				const profile = await authService.getCurrentUserProfile(req.user);
				return sendSuccess(res, profile, "Current user profile");
			}

			throw new AppError(404, "Application profile not found for authenticated identity", {
				code: "APP_PROFILE_NOT_FOUND",
			});
		} catch (error) {
			next(error);
		}
	};

	registerNgo = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.authClaims) {
				throw new AppError(401, "Authentication is required");
			}

			const profile = await authService.registerNgo(req.authClaims, req.body);
			return sendSuccess(res, profile, "NGO account created", 201);
		} catch (error) {
			next(error);
		}
	};

	volunteerOnboardingOptions = async (_req: Request, res: Response, next: NextFunction) => {
		try {
			const options = await authService.getVolunteerOnboardingOptions();
			return sendSuccess(res, options, "Volunteer onboarding options");
		} catch (error) {
			next(error);
		}
	};

	registerVolunteer = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.authClaims) {
				throw new AppError(401, "Authentication is required");
			}

			const profile = await authService.registerVolunteer(req.authClaims, req.body);
			return sendSuccess(res, profile, "Volunteer account created", 201);
		} catch (error) {
			next(error);
		}
	};
}

export const authController = new AuthController();
