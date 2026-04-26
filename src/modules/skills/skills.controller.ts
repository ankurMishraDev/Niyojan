import { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { skillsService } from "./skills.service";

class SkillsController {
	listSkills = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await skillsService.listSkills(req.query);
			return sendSuccess(res, result.items, "Skills list", 200, {
				page: result.page,
				pageSize: result.pageSize,
				total: result.total,
			});
		} catch (error) {
			next(error);
		}
	};

	getSkillById = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const skillId = req.params.id as string;
			const skill = await skillsService.getSkillById(skillId);
			return sendSuccess(res, skill, "Skill details");
		} catch (error) {
			next(error);
		}
	};

	createSkill = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const skill = await skillsService.createSkill(req.body);
			return sendSuccess(res, skill, "Skill created", 201);
		} catch (error) {
			next(error);
		}
	};

	updateSkill = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const skillId = req.params.id as string;
			const skill = await skillsService.updateSkill(skillId, req.body);
			return sendSuccess(res, skill, "Skill updated");
		} catch (error) {
			next(error);
		}
	};

	deleteSkill = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const skillId = req.params.id as string;
			const result = await skillsService.deleteSkill(skillId);
			return sendSuccess(res, result, "Skill deleted");
		} catch (error) {
			next(error);
		}
	};
}

export const skillsController = new SkillsController();
