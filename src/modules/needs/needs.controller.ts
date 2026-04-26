import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { needsService } from "./needs.service";

class NeedsController {
	listNeeds = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const result = await needsService.listNeeds(req.query, req.user);
			return sendSuccess(res, result.items, "Needs list", 200, {
				page: result.page,
				pageSize: result.pageSize,
				total: result.total,
			});
		} catch (error) {
			next(error);
		}
	};

	getNeedById = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const need = await needsService.getNeedById(req.params.id as string, req.user);
			return sendSuccess(res, need, "Need details");
		} catch (error) {
			next(error);
		}
	};

	attachNeedSkills = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const need = await needsService.attachNeedSkills(req.params.id as string, req.body, req.user);
			return sendSuccess(res, need, "Need skills updated");
		} catch (error) {
			next(error);
		}
	};
}

export const needsController = new NeedsController();
