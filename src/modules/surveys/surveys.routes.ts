import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { surveysController } from "./surveys.controller";

const surveysRouter = Router();

const uuidSchema = z.string().uuid();
const inputTypeSchema = z.enum([
	"text",
	"number",
	"boolean",
	"select",
	"multiselect",
	"date",
	"textarea",
	"list",
	"table",
	"signature",
]);

const surveyIdParamsSchema = z.object({
	id: uuidSchema,
});

const createSurveyBodySchema = z.object({
	template_version_id: uuidSchema,
	org_id: uuidSchema.optional(),
	respondent_name: z.string().min(1).max(255).optional(),
	location_text: z.string().min(1).max(255).optional(),
	latitude: z.number().min(-90).max(90).nullable().optional(),
	longitude: z.number().min(-180).max(180).nullable().optional(),
});

const listSurveysQuerySchema = z.object({
	page: z.coerce.number().int().positive().optional(),
	pageSize: z.coerce.number().int().positive().max(100).optional(),
	org_id: uuidSchema.optional(),
	template_version_id: uuidSchema.optional(),
	conducted_by: uuidSchema.optional(),
	status: z.enum(["draft", "submitted", "analyzed"]).optional(),
});

const submitSurveyBodySchema = z.object({
	responses: z
		.array(
			z.object({
				form_field_id: uuidSchema,
				input_type: inputTypeSchema,
				value_text: z.string().nullable().optional(),
				value_number: z.number().nullable().optional(),
				value_bool: z.boolean().nullable().optional(),
				value_json: z.unknown().optional(),
			}),
		),
});

surveysRouter.use(requireAuth);

surveysRouter.post(
	"/",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ body: createSurveyBodySchema }),
	surveysController.createSurvey,
);

surveysRouter.get(
	"/",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ query: listSurveysQuerySchema }),
	surveysController.listSurveys,
);

surveysRouter.get(
	"/:id",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ params: surveyIdParamsSchema }),
	surveysController.getSurveyById,
);

surveysRouter.post(
	"/:id/submit",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ params: surveyIdParamsSchema, body: submitSurveyBodySchema }),
	surveysController.submitSurvey,
);

surveysRouter.post(
	"/:id/analyze-needs",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ params: surveyIdParamsSchema }),
	surveysController.analyzeNeeds,
);

surveysRouter.delete(
	"/:id",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ params: surveyIdParamsSchema }),
	surveysController.deleteSurvey,
);

export default surveysRouter;
