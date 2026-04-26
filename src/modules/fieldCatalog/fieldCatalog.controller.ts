import { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { fieldCatalogService } from "./fieldCatalog.service";

class FieldCatalogController {
	listFields = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await fieldCatalogService.listFields(req.query);
			return sendSuccess(res, result.items, "Field catalog entries", 200, {
				page: result.page,
				pageSize: result.pageSize,
				total: result.total,
			});
		} catch (error) {
			next(error);
		}
	};

	getFieldById = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const fieldId = req.params.id as string;
			const field = await fieldCatalogService.getFieldById(fieldId);
			return sendSuccess(res, field, "Field catalog entry");
		} catch (error) {
			next(error);
		}
	};

	createField = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const field = await fieldCatalogService.createField(req.body);
			return sendSuccess(res, field, "Field catalog entry created", 201);
		} catch (error) {
			next(error);
		}
	};

	updateField = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const fieldId = req.params.id as string;
			const field = await fieldCatalogService.updateField(fieldId, req.body);
			return sendSuccess(res, field, "Field catalog entry updated");
		} catch (error) {
			next(error);
		}
	};

	deleteField = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const fieldId = req.params.id as string;
			const result = await fieldCatalogService.deleteField(fieldId);
			return sendSuccess(res, result, "Field catalog entry deleted");
		} catch (error) {
			next(error);
		}
	};
}

export const fieldCatalogController = new FieldCatalogController();
