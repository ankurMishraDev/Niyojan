import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { formTemplatesService } from "./formTemplates.service";

class FormTemplatesController {
	createTemplate = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const template = await formTemplatesService.createTemplate(req.body, req.user);
			return sendSuccess(res, template, "Form template created", 201);
		} catch (error) {
			next(error);
		}
	};

	listTemplates = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const result = await formTemplatesService.listTemplates(req.query, req.user);
			return sendSuccess(res, result.items, "Form templates", 200, {
				page: result.page,
				pageSize: result.pageSize,
				total: result.total,
			});
		} catch (error) {
			next(error);
		}
	};

	getTemplateById = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const template = await formTemplatesService.getTemplateById(req.params.id as string, req.user);
			return sendSuccess(res, template, "Form template details");
		} catch (error) {
			next(error);
		}
	};

	updateTemplate = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const template = await formTemplatesService.updateTemplate(
				req.params.id as string,
				req.body,
				req.user,
			);
			return sendSuccess(res, template, "Form template updated");
		} catch (error) {
			next(error);
		}
	};

	deleteTemplate = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const result = await formTemplatesService.deleteTemplate(req.params.id as string, req.user);
			return sendSuccess(res, result, "Form template deleted");
		} catch (error) {
			next(error);
		}
	};

	createTemplateVersion = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const version = await formTemplatesService.createVersion(
				req.params.id as string,
				req.body,
				req.user,
			);

			return sendSuccess(res, version, "Form template version created", 201);
		} catch (error) {
			next(error);
		}
	};

	listTemplateVersions = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const versions = await formTemplatesService.listTemplateVersions(
				req.params.id as string,
				req.user,
			);

			return sendSuccess(res, versions, "Form template versions");
		} catch (error) {
			next(error);
		}
	};

	getTemplateVersionById = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const version = await formTemplatesService.getVersionById(req.params.id as string, req.user);
			return sendSuccess(res, version, "Form template version details");
		} catch (error) {
			next(error);
		}
	};

	updateTemplateVersion = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const version = await formTemplatesService.updateVersion(
				req.params.id as string,
				req.body,
				req.user,
			);

			return sendSuccess(res, version, "Form template version updated");
		} catch (error) {
			next(error);
		}
	};

	deleteTemplateVersion = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const result = await formTemplatesService.deleteVersion(req.params.id as string, req.user);
			return sendSuccess(res, result, "Form template version deleted");
		} catch (error) {
			next(error);
		}
	};

	addVersionField = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const field = await formTemplatesService.addFieldToVersion(
				req.params.id as string,
				req.body,
				req.user,
			);

			return sendSuccess(res, field, "Form field added", 201);
		} catch (error) {
			next(error);
		}
	};

	updateField = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const field = await formTemplatesService.updateField(req.params.id as string, req.body, req.user);
			return sendSuccess(res, field, "Form field updated");
		} catch (error) {
			next(error);
		}
	};

	deleteField = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const result = await formTemplatesService.deleteField(req.params.id as string, req.user);
			return sendSuccess(res, result, "Form field deleted");
		} catch (error) {
			next(error);
		}
	};

	publishVersion = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const version = await formTemplatesService.publishVersion(req.params.id as string, req.user);
			return sendSuccess(res, version, "Form template version published");
		} catch (error) {
			next(error);
		}
	};

	createTemplateFromDocument = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const result = await formTemplatesService.createTemplateFromDocument(
				req.params.documentId as string,
				req.body,
				req.user,
			);

			return sendSuccess(res, result, "Draft form template created from extraction", 201);
		} catch (error) {
			next(error);
		}
	};
}

export const formTemplatesController = new FormTemplatesController();
