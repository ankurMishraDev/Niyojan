import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { assignmentsService } from "./assignments.service";

class AssignmentsController {
	createAssignment = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const assignment = await assignmentsService.createAssignment(req.body, req.user);
			return sendSuccess(res, assignment, "Assignment created", 201);
		} catch (error) {
			next(error);
		}
	};

	listAssignments = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const result = await assignmentsService.listAssignments(req.query, req.user);
			return sendSuccess(res, result.items, "Assignments list", 200, {
				page: result.page,
				pageSize: result.pageSize,
				total: result.total,
			});
		} catch (error) {
			next(error);
		}
	};

	getAssignmentById = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const assignment = await assignmentsService.getAssignmentById(req.params.id as string, req.user);
			return sendSuccess(res, assignment, "Assignment details");
		} catch (error) {
			next(error);
		}
	};

	updateAssignmentStatus = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const assignment = await assignmentsService.updateAssignmentStatus(
				req.params.id as string,
				req.body,
				req.user,
			);
			return sendSuccess(res, assignment, "Assignment status updated");
		} catch (error) {
			next(error);
		}
	};
}

export const assignmentsController = new AssignmentsController();
