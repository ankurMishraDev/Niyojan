import { NextFunction, Request, Response } from "express";
import { env } from "../../config/env";
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

			if (env.AUTH_MOCK_MODE && req.authClaims) {
				const profile = await authService.getOrCreateMockUserFromClaims(req.authClaims);
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
			return sendSuccess(res, profile, "NGO registration submitted", 201);
		} catch (error) {
			next(error);
		}
	};
}

export const authController = new AuthController();
