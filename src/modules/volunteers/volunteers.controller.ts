import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { volunteersService } from "./volunteers.service";

class VolunteersController {
	createVolunteer = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const volunteer = await volunteersService.createVolunteer(req.body, req.user);
			return sendSuccess(res, volunteer, "Volunteer created", 201);
		} catch (error) {
			next(error);
		}
	};

	listVolunteers = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const result = await volunteersService.listVolunteers(req.query, req.user);
			return sendSuccess(res, result.items, "Volunteers list", 200, {
				page: result.page,
				pageSize: result.pageSize,
				total: result.total,
			});
		} catch (error) {
			next(error);
		}
	};

	getVolunteerById = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const volunteerId = req.params.id as string;
			const volunteer = await volunteersService.getVolunteerById(volunteerId, req.user);
			return sendSuccess(res, volunteer, "Volunteer details");
		} catch (error) {
			next(error);
		}
	};

	updateVolunteer = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const volunteerId = req.params.id as string;
			const volunteer = await volunteersService.updateVolunteer(volunteerId, req.body, req.user);
			return sendSuccess(res, volunteer, "Volunteer updated");
		} catch (error) {
			next(error);
		}
	};

	attachVolunteerSkills = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const volunteer = await volunteersService.attachVolunteerSkills(
				req.params.id as string,
				req.body,
				req.user,
			);

			return sendSuccess(res, volunteer, "Volunteer skills updated");
		} catch (error) {
			next(error);
		}
	};
}

export const volunteersController = new VolunteersController();
