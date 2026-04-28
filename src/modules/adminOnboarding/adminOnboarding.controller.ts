import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { authService } from "../auth/auth.service";

class AdminOnboardingController {
	listNgoRegistrations = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const items = await authService.listOnboardingOrganizations(req.query);
			return sendSuccess(res, items, "NGO onboarding registrations");
		} catch (error) {
			next(error);
		}
	};

	approveNgo = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const result = await authService.updateOnboardingStatus(
				req.params.orgId as string,
				"approve",
				req.user,
			);
			return sendSuccess(res, result, "NGO approved");
		} catch (error) {
			next(error);
		}
	};

	rejectNgo = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const result = await authService.updateOnboardingStatus(
				req.params.orgId as string,
				"reject",
				req.user,
			);
			return sendSuccess(res, result, "NGO rejected");
		} catch (error) {
			next(error);
		}
	};
}

export const adminOnboardingController = new AdminOnboardingController();
