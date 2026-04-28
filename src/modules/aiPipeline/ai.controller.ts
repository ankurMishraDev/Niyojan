import { NextFunction, Request, Response } from "express";
import { db } from "../../config/db";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { aiOrchestratorService } from "./aiOrchestrator.service";

type DocumentRow = {
	id: string;
	org_id: string;
	file_name: string;
	gcs_path: string;
	file_type: string;
};

class AiController {
	getStatus = async (_req: Request, res: Response, next: NextFunction) => {
		try {
			const status = {
				providerMode: "live",
				documentProvider: "google-document-ai",
				reasoningProvider: "vertex-ai-gemini",
			};

			return sendSuccess(res, status, "AI provider status");
		} catch (error) {
			next(error);
		}
	};

	previewDocumentExtraction = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const document = (await db("documents")
				.where({ id: req.params.id })
				.first()) as DocumentRow | undefined;

			if (!document) {
				throw new AppError(404, "Document not found");
			}

			if (req.user.role !== "superadmin" && req.user.orgId !== document.org_id) {
				throw new AppError(403, "Cross-organization access is not allowed");
			}

			const result = await aiOrchestratorService.extractAndMapDocumentFields({
				documentId: document.id,
				gcsPath: document.gcs_path,
				fileName: document.file_name,
				fileType: document.file_type,
			});

			return sendSuccess(res, result, "AI extraction preview generated");
		} catch (error) {
			next(error);
		}
	};
}

export const aiController = new AiController();
