import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { feedbackService } from "./feedback.service";

class FeedbackController {
	submitFeedback = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const feedback = await feedbackService.submitFeedback(req.params.id as string, req.body, req.user);
			return sendSuccess(res, feedback, "Feedback submitted", 201);
		} catch (error) {
			next(error);
		}
	};

	getFeedbackByAssignment = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const feedback = await feedbackService.getFeedbackByAssignment(req.params.id as string, req.user);
			return sendSuccess(res, feedback, "Assignment feedback");
		} catch (error) {
			next(error);
		}
	};

	createEvidenceUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const result = await feedbackService.createEvidenceUploadUrl(req.params.id as string, req.body, req.user);
			return sendSuccess(res, result, "Feedback evidence upload URL generated", 201);
		} catch (error) {
			next(error);
		}
	};

	createEvidenceReadUrl = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) throw new AppError(401, "Authentication is required");
			const { gcs_path } = req.body as { gcs_path: string };
			const { generateSignedReadUrl } = await import("../../config/gcp");
			const signed = await generateSignedReadUrl(gcs_path);
			return sendSuccess(res, { readUrl: signed.url, expiresAt: signed.expiresAt }, "Evidence read URL generated");
		} catch (error) {
			next(error);
		}
	};

	closeNeed = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const outcome = await feedbackService.closeNeed(req.params.id as string, req.body, req.user);
			return sendSuccess(res, outcome, "Need closed with case outcome", 201);
		} catch (error) {
			next(error);
		}
	};
}

export const feedbackController = new FeedbackController();
