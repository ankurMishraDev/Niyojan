import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { dashboardService } from "./dashboard.service";

class DashboardController {
	getSummary = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const summary = await dashboardService.getSummary(req.user);
			return sendSuccess(res, summary, "Dashboard summary");
		} catch (error) {
			next(error);
		}
	};

	getUrgentNeeds = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const urgentNeeds = await dashboardService.getUrgentNeeds(req.user);
			return sendSuccess(res, urgentNeeds, "Urgent needs");
		} catch (error) {
			next(error);
		}
	};

	getSubmittedSurveyCases = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const submittedSurveys = await dashboardService.getSubmittedSurveyCases(req.user, req.query);
			return sendSuccess(res, submittedSurveys, "Submitted survey cases");
		} catch (error) {
			next(error);
		}
	};

	getVolunteerAvailability = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const availability = await dashboardService.getVolunteerAvailability(req.user);
			return sendSuccess(res, availability, "Volunteer availability");
		} catch (error) {
			next(error);
		}
	};

	getPipelineHealth = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const pipelineHealth = await dashboardService.getPipelineHealth(req.user);
			return sendSuccess(res, pipelineHealth, "Pipeline health");
		} catch (error) {
			next(error);
		}
	};
}

export const dashboardController = new DashboardController();
