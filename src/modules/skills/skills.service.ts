import { db } from "../../config/db";
import { AppError } from "../../middleware/errorHandler";
import { getPaginationParams } from "../../utils/pagination";

type SkillRow = {
	id: string;
	key: string;
	name: string;
	category: string;
	created_at: Date;
	updated_at: Date;
};

type ListSkillsQuery = {
	page?: string | number;
	pageSize?: string | number;
	category?: string;
	search?: string;
};

type CreateSkillInput = {
	key: string;
	name: string;
	category: string;
};

type UpdateSkillInput = Partial<CreateSkillInput>;

const mapSkill = (skill: SkillRow) => {
	return {
		id: skill.id,
		key: skill.key,
		name: skill.name,
		category: skill.category,
		createdAt: skill.created_at,
		updatedAt: skill.updated_at,
	};
};

export class SkillsService {
	async listSkills(query: ListSkillsQuery) {
		const { page, pageSize, offset } = getPaginationParams(query.page, query.pageSize);

		const baseQuery = db("skills");

		if (query.category) {
			baseQuery.andWhere("category", query.category);
		}

		if (query.search) {
			baseQuery.andWhere((builder) => {
				builder
					.where("name", "ilike", `%${query.search}%`)
					.orWhere("key", "ilike", `%${query.search}%`)
					.orWhere("category", "ilike", `%${query.search}%`);
			});
		}

		const rows = (await baseQuery
			.clone()
			.orderBy("created_at", "desc")
			.offset(offset)
			.limit(pageSize)
			.select("*")) as SkillRow[];

		const countResult = (await baseQuery.clone().clearSelect().count({ count: "*" }).first()) as
			| { count: string }
			| undefined;

		return {
			items: rows.map(mapSkill),
			page,
			pageSize,
			total: Number(countResult?.count || 0),
		};
	}

	async getSkillById(skillId: string) {
		const skill = (await db("skills").where({ id: skillId }).first()) as SkillRow | undefined;

		if (!skill) {
			throw new AppError(404, "Skill not found");
		}

		return mapSkill(skill);
	}

	async createSkill(input: CreateSkillInput) {
		const [skill] = (await db("skills")
			.insert({
				key: input.key,
				name: input.name,
				category: input.category,
			})
			.returning("*")) as SkillRow[];

		return mapSkill(skill);
	}

	async updateSkill(skillId: string, input: UpdateSkillInput) {
		await this.getSkillById(skillId);

		const payload: Record<string, unknown> = {};

		if (input.key !== undefined) {
			payload.key = input.key;
		}

		if (input.name !== undefined) {
			payload.name = input.name;
		}

		if (input.category !== undefined) {
			payload.category = input.category;
		}

		if (Object.keys(payload).length === 0) {
			throw new AppError(400, "No skill fields provided for update");
		}

		const [skill] = (await db("skills")
			.where({ id: skillId })
			.update({
				...payload,
				updated_at: new Date(),
			})
			.returning("*")) as SkillRow[];

		return mapSkill(skill);
	}

	async deleteSkill(skillId: string) {
		await this.getSkillById(skillId);

		await db("skills").where({ id: skillId }).del();
		return { id: skillId };
	}
}

export const skillsService = new SkillsService();
