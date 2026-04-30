import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { surveysService } from "./surveys.service";

class SurveysController {
	createSurvey = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const survey = await surveysService.createSurvey(req.body, req.user);
			return sendSuccess(res, survey, "Survey draft created", 201);
		} catch (error) {
			next(error);
		}
	};

	listSurveys = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const result = await surveysService.listSurveys(req.query, req.user);
			return sendSuccess(res, result.items, "Surveys list", 200, {
				page: result.page,
				pageSize: result.pageSize,
				total: result.total,
			});
		} catch (error) {
			next(error);
		}
	};

	getSurveyById = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const survey = await surveysService.getSurveyById(req.params.id as string, req.user);
			return sendSuccess(res, survey, "Survey details");
		} catch (error) {
			next(error);
		}
	};

	submitSurvey = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			console.log("SUBMIT SURVEY BODY:", JSON.stringify(req.body, null, 2));

			const survey = await surveysService.submitSurvey(req.params.id as string, req.body, req.user);
			return sendSuccess(res, survey, "Survey submitted");
		} catch (error) {
			next(error);
		}
	};

	analyzeNeeds = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const result = await surveysService.analyzeNeeds(req.params.id as string, req.user);
			return sendSuccess(res, result, "Survey needs analysis completed");
		} catch (error) {
			next(error);
		}
	};

	deleteSurvey = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}
			await surveysService.deleteSurvey(req.params.id as string);
			return sendSuccess(res, {}, "Survey deleted successfully");
		} catch (error) {
			next(error);
		}
	};
}

export const surveysController = new SurveysController();
