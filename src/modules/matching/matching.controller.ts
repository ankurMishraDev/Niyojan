import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { matchingService } from "./matching.service";

class MatchingController {
	getMatchesForNeed = async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.user) {
				throw new AppError(401, "Authentication is required");
			}

			const result = await matchingService.getMatchesForNeed(req.params.id as string, req.user);
			return sendSuccess(res, result, "Volunteer matches generated");
		} catch (error) {
			next(error);
		}
	};
}

export const matchingController = new MatchingController();
