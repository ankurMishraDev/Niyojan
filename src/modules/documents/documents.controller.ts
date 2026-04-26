import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { documentsService } from "./documents.service";

class DocumentsController {
	createUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const result = await documentsService.createUploadUrl(req.body, req.user);
			return sendSuccess(res, result, "Signed upload URL generated", 201);
		} catch (error) {
			next(error);
		}
	};

	createDocument = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const document = await documentsService.createDocument(req.body, req.user);
			return sendSuccess(res, document, "Document metadata saved", 201);
		} catch (error) {
			next(error);
		}
	};

	listDocuments = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const result = await documentsService.listDocuments(req.query, req.user);
			return sendSuccess(res, result.items, "Documents list", 200, {
				page: result.page,
				pageSize: result.pageSize,
				total: result.total,
			});
		} catch (error) {
			next(error);
		}
	};

	getDocumentById = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const document = await documentsService.getDocumentById(req.params.id as string, req.user);
			return sendSuccess(res, document, "Document details");
		} catch (error) {
			next(error);
		}
	};

	getDocumentReadUrl = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const result = await documentsService.getDocumentReadUrl(req.params.id as string, req.user);
			return sendSuccess(res, result, "Signed read URL generated");
		} catch (error) {
			next(error);
		}
	};

	updateDocumentStatus = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const document = await documentsService.updateDocumentStatus(
				req.params.id as string,
				req.body,
				req.user,
			);

			return sendSuccess(res, document, "Document status updated");
		} catch (error) {
			next(error);
		}
	};

	triggerExtraction = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const result = await documentsService.triggerExtraction(req.params.id as string, req.user);
			return sendSuccess(res, result, "Document extraction completed");
		} catch (error) {
			next(error);
		}
	};
}

export const documentsController = new DocumentsController();
