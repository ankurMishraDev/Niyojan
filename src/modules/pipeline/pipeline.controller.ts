import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { pipelineOrchestrator } from "./pipeline.orchestrator";

class PipelineController {
	startPipeline = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) throw new AppError(401, "Authentication is required");
			const result = await pipelineOrchestrator.startDocumentPipeline(req.params.id as string, req.user);
			return sendSuccess(res, result, "Pipeline started");
		} catch (error) {
			next(error);
		}
	};

	getPipelineStatus = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) throw new AppError(401, "Authentication is required");
			const result = await pipelineOrchestrator.getDocumentPipelineStatus(req.params.id as string, req.user);
			return sendSuccess(res, result, "Pipeline status");
		} catch (error) {
			next(error);
		}
	};

	getReviewPackage = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) throw new AppError(401, "Authentication is required");
			const result = await pipelineOrchestrator.getReviewPackage(req.params.id as string, req.user);
			return sendSuccess(res, result, "Review package");
		} catch (error) {
			next(error);
		}
	};

	submitReview = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) throw new AppError(401, "Authentication is required");
			const result = await pipelineOrchestrator.submitHumanReview(req.params.id as string, req.body, req.user);
			return sendSuccess(res, result, "Human review submitted");
		} catch (error) {
			next(error);
		}
	};

	createForm = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) throw new AppError(401, "Authentication is required");
			const result = await pipelineOrchestrator.createDraftFormFromPipeline(req.params.id as string, req.body, req.user);
			return sendSuccess(res, result, "Draft form created from pipeline review");
		} catch (error) {
			next(error);
		}
	};

	listIntake = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) throw new AppError(401, "Authentication is required");
			const result = await pipelineOrchestrator.listSurveyIntake(req.user);
			return sendSuccess(res, result, "Pipeline intake");
		} catch (error) {
			next(error);
		}
	};

	listQueue = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) throw new AppError(401, "Authentication is required");
			const result = await pipelineOrchestrator.listPipelineQueue(req.user, req.query);
			return sendSuccess(res, result, "Pipeline queue");
		} catch (error) {
			next(error);
		}
	};

	getManifest = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) throw new AppError(401, "Authentication is required");
			const result = await pipelineOrchestrator.getManifestById(req.params.id as string, req.user);
			return sendSuccess(res, result, "Pipeline manifest");
		} catch (error) {
			next(error);
		}
	};
}

export const pipelineController = new PipelineController();
