import { db } from "../../config/db";
import { AppError } from "../../middleware/errorHandler";
import { getPaginationParams } from "../../utils/pagination";

type FieldCatalogRow = {
	id: string;
	key: string;
	name: string;
	category: string;
	input_type: string;
	options_json: unknown;
	validation_json: unknown;
	is_system: boolean;
	created_at: Date;
	updated_at: Date;
};

export type CreateFieldCatalogInput = {
	key: string;
	name: string;
	category: string;
	input_type: string;
	options_json?: unknown;
	validation_json?: unknown;
	is_system?: boolean;
};

export type UpdateFieldCatalogInput = Partial<CreateFieldCatalogInput>;

type ListFieldCatalogQuery = {
	page?: string | number;
	pageSize?: string | number;
	category?: string;
	input_type?: string;
	is_system?: string;
	search?: string;
};

const toJson = (value: unknown) => {
	if (value === undefined || value === null) {
		return null;
	}

	return JSON.stringify(value);
};

const fromJson = (value: unknown) => {
	if (value === null || value === undefined) {
		return null;
	}

	if (typeof value === "string") {
		try {
			return JSON.parse(value);
		} catch {
			return value;
		}
	}

	return value;
};

const parseOptionalBoolean = (value?: string) => {
	if (value === undefined) {
		return undefined;
	}

	if (value === "true") {
		return true;
	}

	if (value === "false") {
		return false;
	}

	return undefined;
};

const mapFieldCatalog = (field: FieldCatalogRow) => {
	return {
		id: field.id,
		key: field.key,
		name: field.name,
		category: field.category,
		inputType: field.input_type,
		options: fromJson(field.options_json),
		validation: fromJson(field.validation_json),
		isSystem: field.is_system,
		createdAt: field.created_at,
		updatedAt: field.updated_at,
	};
};

export class FieldCatalogService {
	async listFields(query: ListFieldCatalogQuery) {
		const { page, pageSize, offset } = getPaginationParams(query.page, query.pageSize);

		const baseQuery = db("field_catalog");

		if (query.category) {
			baseQuery.andWhere("category", query.category);
		}

		if (query.input_type) {
			baseQuery.andWhere("input_type", query.input_type);
		}

		const isSystemFilter = parseOptionalBoolean(query.is_system);
		if (isSystemFilter !== undefined) {
			baseQuery.andWhere("is_system", isSystemFilter);
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
			.select("*")
			.orderBy("created_at", "desc")
			.offset(offset)
			.limit(pageSize)) as FieldCatalogRow[];

		const countResult = (await baseQuery.clone().clearSelect().count({ count: "*" }).first()) as
			| { count: string }
			| undefined;

		return {
			items: rows.map(mapFieldCatalog),
			page,
			pageSize,
			total: Number(countResult?.count || 0),
		};
	}

	async getFieldById(fieldId: string) {
		const field = (await db("field_catalog").where({ id: fieldId }).first()) as
			| FieldCatalogRow
			| undefined;

		if (!field) {
			throw new AppError(404, "Field catalog entry not found");
		}

		return mapFieldCatalog(field);
	}

	async createField(input: CreateFieldCatalogInput) {
		const [field] = (await db("field_catalog")
			.insert({
				key: input.key,
				name: input.name,
				category: input.category,
				input_type: input.input_type,
				options_json: toJson(input.options_json),
				validation_json: toJson(input.validation_json),
				is_system: input.is_system || false,
			})
			.returning("*")) as FieldCatalogRow[];

		return mapFieldCatalog(field);
	}

	async updateField(fieldId: string, input: UpdateFieldCatalogInput) {
		await this.getFieldById(fieldId);

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

		if (input.input_type !== undefined) {
			payload.input_type = input.input_type;
		}

		if (input.options_json !== undefined) {
			payload.options_json = toJson(input.options_json);
		}

		if (input.validation_json !== undefined) {
			payload.validation_json = toJson(input.validation_json);
		}

		if (input.is_system !== undefined) {
			payload.is_system = input.is_system;
		}

		if (Object.keys(payload).length === 0) {
			throw new AppError(400, "No field catalog data provided for update");
		}

		const [field] = (await db("field_catalog")
			.where({ id: fieldId })
			.update({
				...payload,
				updated_at: new Date(),
			})
			.returning("*")) as FieldCatalogRow[];

		return mapFieldCatalog(field);
	}

	async deleteField(fieldId: string) {
		const field = (await db("field_catalog").where({ id: fieldId }).first()) as
			| FieldCatalogRow
			| undefined;

		if (!field) {
			throw new AppError(404, "Field catalog entry not found");
		}

		if (field.is_system) {
			throw new AppError(400, "System field catalog entries cannot be deleted");
		}

		await db("field_catalog").where({ id: fieldId }).del();
		return { id: fieldId };
	}
}

export const fieldCatalogService = new FieldCatalogService();
