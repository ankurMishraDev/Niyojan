import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { authService } from "./auth.service";

class AuthController {
	me = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const profile = await authService.getOrCreateCurrentUser(req.user);

			req.user = {
				id: profile.id,
				orgId: profile.orgId,
				firebaseUid: profile.firebaseUid,
				role: profile.role,
				email: profile.email,
				name: profile.name,
			};

			return sendSuccess(res, profile, "Current user profile");
		} catch (error) {
			next(error);
		}
	};
}

export const authController = new AuthController();
