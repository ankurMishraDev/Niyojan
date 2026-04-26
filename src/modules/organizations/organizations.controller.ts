import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { organizationsService } from "./organizations.service";

class OrganizationsController {
	createOrganization = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const organization = await organizationsService.createOrganization(req.body, req.user);
			return sendSuccess(res, organization, "Organization created", 201);
		} catch (error) {
			next(error);
		}
	};

	getOrganizationById = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const orgId = req.params.id as string;
			const organization = await organizationsService.getOrganizationById(orgId, req.user);
			return sendSuccess(res, organization, "Organization details");
		} catch (error) {
			next(error);
		}
	};

	updateOrganization = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const organization = await organizationsService.updateOrganization(
				req.params.id as string,
				req.body,
				req.user,
			);

			return sendSuccess(res, organization, "Organization updated");
		} catch (error) {
			next(error);
		}
	};

	listOrganizationUsers = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const result = await organizationsService.listOrganizationUsers(
				req.params.id as string,
				req.query,
				req.user,
			);

			return sendSuccess(res, result.items, "Organization users", 200, {
				page: result.page,
				pageSize: result.pageSize,
				total: result.total,
			});
		} catch (error) {
			next(error);
		}
	};
}

export const organizationsController = new OrganizationsController();
