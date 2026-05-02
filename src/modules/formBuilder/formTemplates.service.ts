import { db } from "../../config/db";
import { AppError } from "../../middleware/errorHandler";
import { AuthenticatedUser } from "../../types/auth";
import { getPaginationParams } from "../../utils/pagination";

type FormTemplateRow = {
  id: string;
  org_id: string;
  created_by: string | null;
  source_document_id: string | null;
  name: string;
  status: string;
  created_at: Date;
  updated_at: Date;
};

type FormTemplateVersionRow = {
  id: string;
  template_id: string;
  version_no: number;
  status: string;
  is_published: boolean;
  created_at: Date;
  updated_at: Date;
};

type FormFieldRow = {
  id: string;
  template_version_id: string;
  field_catalog_id: string | null;
  label: string;
  input_type: string;
  options_json: unknown;
  is_required: boolean;
  display_order: number;
  is_custom: boolean;
  created_at: Date;
  updated_at: Date;
};

type DocumentRow = {
  id: string;
  org_id: string;
  file_name: string;
  extraction_result_json: unknown;
};

type FieldCatalogRow = {
  id: string;
  key: string;
  name: string;
  input_type: string;
  options_json: unknown;
};

type TemplateWithOrgRow = {
  id: string;
  org_id: string;
  created_by: string | null;
  source_document_id: string | null;
  name: string;
  status: string;
  created_at: Date;
  updated_at: Date;
};

type VersionWithTemplateOrgRow = {
  id: string;
  template_id: string;
  version_no: number;
  status: string;
  is_published: boolean;
  created_at: Date;
  updated_at: Date;
  template_org_id: string;
  template_name: string;
};

type FieldWithVersionAndTemplateRow = FormFieldRow & {
  version_status: string;
  version_is_published: boolean;
  template_org_id: string;
};

type CreateTemplateInput = {
  name: string;
  org_id?: string;
  source_document_id?: string;
  status?: "draft" | "active" | "archived";
};

type ListTemplatesQuery = {
  page?: string | number;
  pageSize?: string | number;
  org_id?: string;
  status?: string;
  search?: string;
};

type CreateVersionInput = {
  status?: "draft" | "review_pending" | "archived" | "published";
  copy_fields_from_version_id?: string;
};

type UpdateVersionInput = {
  status?: "draft" | "review_pending" | "archived" | "published";
};

type UpdateTemplateInput = {
  name?: string;
  status?: "draft" | "active" | "archived";
};

type AddFieldInput = {
  field_catalog_id?: string;
  label?: string;
  input_type?: string;
  options_json?: unknown;
  is_required?: boolean;
  display_order?: number;
  is_custom?: boolean;
};

type UpdateFieldInput = {
  field_catalog_id?: string | null;
  label?: string;
  input_type?: string;
  options_json?: unknown;
  is_required?: boolean;
  display_order?: number;
  is_custom?: boolean;
};

type CreateTemplateFromDocumentInput = {
  name?: string;
};

type ExtractionMappedField = {
  label?: string;
  inputType?: string;
  options?: unknown;
  required?: boolean;
  fieldCatalogId?: string | null;
  isCustom?: boolean;
};

type ExtractionCandidateField = {
  label?: string;
  inputType?: string;
  options?: unknown;
  required?: boolean;
};

type ExtractionKeyValuePair = {
  label?: string;
  value?: string;
};

type NormalizedExtractionField = {
  label: string;
  inputType: string;
  options: unknown;
  required: boolean;
  fieldCatalogId: string | null;
  isCustom: boolean;
};

const TEMPLATE_STATUSES = new Set(["draft", "active", "archived"]);
const VERSION_STATUSES = new Set([
  "draft",
  "review_pending",
  "published",
  "archived",
]);

const toJson = (value: unknown) => {
  if (value === null || value === undefined) {
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

const assertOrgScope = (user: AuthenticatedUser, orgId: string) => {
  if (user.role === "superadmin") {
    return;
  }

  if (!user.orgId || user.orgId !== orgId) {
    throw new AppError(403, "Cross-organization access is not allowed");
  }
};

const resolveTargetOrgId = (
  user: AuthenticatedUser,
  orgIdFromInput?: string,
) => {
  if (user.role === "superadmin") {
    if (!orgIdFromInput) {
      throw new AppError(400, "org_id is required for superadmin requests");
    }

    return orgIdFromInput;
  }

  if (!user.orgId) {
    throw new AppError(
      400,
      "Authenticated user organization context is missing",
    );
  }

  if (orgIdFromInput && orgIdFromInput !== user.orgId) {
    throw new AppError(403, "Organization scope mismatch");
  }

  return user.orgId;
};

const mapTemplate = (template: FormTemplateRow) => {
  return {
    id: template.id,
    orgId: template.org_id,
    createdBy: template.created_by,
    sourceDocumentId: template.source_document_id,
    name: template.name,
    status: template.status,
    createdAt: template.created_at,
    updatedAt: template.updated_at,
  };
};

const mapVersion = (version: FormTemplateVersionRow) => {
  return {
    id: version.id,
    templateId: version.template_id,
    versionNo: version.version_no,
    status: version.status,
    isPublished: version.is_published,
    createdAt: version.created_at,
    updatedAt: version.updated_at,
  };
};

const mapField = (field: FormFieldRow) => {
  return {
    id: field.id,
    templateVersionId: field.template_version_id,
    fieldCatalogId: field.field_catalog_id,
    label: field.label,
    inputType: field.input_type,
    options: fromJson(field.options_json),
    isRequired: field.is_required,
    displayOrder: field.display_order,
    isCustom: field.is_custom,
    createdAt: field.created_at,
    updatedAt: field.updated_at,
  };
};

const getTemplateByIdInternal = async (templateId: string) => {
  return (await db("form_templates").where({ id: templateId }).first()) as
    | FormTemplateRow
    | undefined;
};

const getTemplateWithOrgByVersionId = async (versionId: string) => {
  return (await db("form_template_versions as v")
    .join("form_templates as t", "v.template_id", "t.id")
    .where("v.id", versionId)
    .select(
      "v.id",
      "v.template_id",
      "v.version_no",
      "v.status",
      "v.is_published",
      "v.created_at",
      "v.updated_at",
      "t.org_id as template_org_id",
      "t.name as template_name",
    )
    .first()) as VersionWithTemplateOrgRow | undefined;
};

const getFieldWithContext = async (fieldId: string) => {
  return (await db("form_fields as f")
    .join("form_template_versions as v", "f.template_version_id", "v.id")
    .join("form_templates as t", "v.template_id", "t.id")
    .where("f.id", fieldId)
    .select(
      "f.id",
      "f.template_version_id",
      "f.field_catalog_id",
      "f.label",
      "f.input_type",
      "f.options_json",
      "f.is_required",
      "f.display_order",
      "f.is_custom",
      "f.created_at",
      "f.updated_at",
      "v.status as version_status",
      "v.is_published as version_is_published",
      "t.org_id as template_org_id",
    )
    .first()) as FieldWithVersionAndTemplateRow | undefined;
};

const assertDraftVersion = (version: {
  status: string;
  is_published: boolean;
}) => {
  if (version.is_published || version.status === "published") {
    throw new AppError(400, "Published versions are immutable");
  }

  if (version.status !== "draft") {
    throw new AppError(
      400,
      "Fields can only be modified while the version is in draft status",
    );
  }
};

const normalizeFieldIdentity = (
  field: Pick<NormalizedExtractionField, "label" | "fieldCatalogId">,
) => {
  if (field.fieldCatalogId) {
    return `catalog:${field.fieldCatalogId}`;
  }

  return `label:${field.label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}`;
};

const dedupeOrderedFields = (fields: NormalizedExtractionField[]) => {
  const seen = new Set<string>();
  return fields.filter((field) => {
    const identity = normalizeFieldIdentity(field);
    if (seen.has(identity)) {
      return false;
    }

    seen.add(identity);
    return true;
  });
};

const mapMappedFields = (fields: ExtractionMappedField[]) => {
  return dedupeOrderedFields(
    fields
      .filter((field) => field.label && field.inputType)
      .map((field) => ({
        label: field.label as string,
        inputType: field.inputType as string,
        options: field.options ?? null,
        required: Boolean(field.required),
        fieldCatalogId: field.fieldCatalogId || null,
        isCustom: field.isCustom ?? !field.fieldCatalogId,
      })),
  );
};

const mapCandidateFields = (fields: ExtractionCandidateField[]) => {
  return dedupeOrderedFields(
    fields
      .filter((field) => field.label && field.inputType)
      .map((field) => ({
        label: field.label as string,
        inputType: field.inputType as string,
        options: field.options ?? null,
        required: Boolean(field.required),
        fieldCatalogId: null,
        isCustom: true,
      })),
  );
};

const mapKeyValuePairs = (pairs: ExtractionKeyValuePair[]) => {
  return dedupeOrderedFields(
    pairs
      .filter((pair) => pair.label)
      .map((pair) => ({
        label: pair.label as string,
        inputType: "text",
        options: null,
        required: false,
        fieldCatalogId: null,
        isCustom: true,
      })),
  );
};

const mergeOrderedFields = (
  sourceFields: NormalizedExtractionField[],
  mappedFields: NormalizedExtractionField[],
) => {
  return dedupeOrderedFields(
    sourceFields.map((sourceField, index) => {
      const mappedField = mappedFields[index];
      if (!mappedField) {
        return sourceField;
      }

      return {
        label: mappedField.label,
        inputType: mappedField.inputType,
        options: mappedField.options,
        required: mappedField.required,
        fieldCatalogId: mappedField.fieldCatalogId,
        isCustom: mappedField.isCustom,
      };
    }),
  );
};

const parseExtractionFields = (extraction: unknown) => {
  const parsed = fromJson(extraction) as {
    mappedFields?: ExtractionMappedField[];
    extractedFields?: ExtractionCandidateField[];
    fieldMapping?: {
      mappedFields?: ExtractionMappedField[];
    };
    documentAi?: {
      fields?: ExtractionCandidateField[];
      keyValuePairs?: ExtractionKeyValuePair[];
    };
  } | null;

  if (!parsed) {
    return [] as NormalizedExtractionField[];
  }

  const sourceCandidateFields = Array.isArray(parsed.documentAi?.fields)
    ? mapCandidateFields(parsed.documentAi.fields)
    : Array.isArray(parsed.extractedFields)
      ? mapCandidateFields(parsed.extractedFields)
      : [];
  const sourceMappedFields = Array.isArray(parsed.fieldMapping?.mappedFields)
    ? mapMappedFields(parsed.fieldMapping.mappedFields)
    : Array.isArray(parsed.mappedFields)
      ? mapMappedFields(parsed.mappedFields)
      : [];

  if (sourceCandidateFields.length > 0 && sourceMappedFields.length > 0) {
    return mergeOrderedFields(sourceCandidateFields, sourceMappedFields);
  }

  if (Array.isArray(parsed.mappedFields) && parsed.mappedFields.length > 0) {
    return mapMappedFields(parsed.mappedFields);
  }

  if (
    Array.isArray(parsed.extractedFields) &&
    parsed.extractedFields.length > 0
  ) {
    return mapCandidateFields(parsed.extractedFields);
  }

  if (
    Array.isArray(parsed.fieldMapping?.mappedFields) &&
    parsed.fieldMapping.mappedFields.length > 0
  ) {
    return mapMappedFields(parsed.fieldMapping.mappedFields);
  }

  if (
    Array.isArray(parsed.documentAi?.fields) &&
    parsed.documentAi.fields.length > 0
  ) {
    return mapCandidateFields(parsed.documentAi.fields);
  }

  if (
    Array.isArray(parsed.documentAi?.keyValuePairs) &&
    parsed.documentAi.keyValuePairs.length > 0
  ) {
    return mapKeyValuePairs(parsed.documentAi.keyValuePairs);
  }

  return [] as NormalizedExtractionField[];
};

const humanizeKey = (key: string) => {
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export class FormTemplatesService {
  async createTemplate(input: CreateTemplateInput, user: AuthenticatedUser) {
    if (!input.name?.trim()) {
      throw new AppError(400, "Template name is required");
    }

    const orgId = resolveTargetOrgId(user, input.org_id);
    const status = input.status || "draft";

    if (!TEMPLATE_STATUSES.has(status)) {
      throw new AppError(400, "Invalid form template status");
    }

    if (input.source_document_id) {
      const sourceDocument = (await db("documents")
        .where({ id: input.source_document_id })
        .first()) as DocumentRow | undefined;

      if (!sourceDocument) {
        throw new AppError(404, "Source document not found");
      }

      if (sourceDocument.org_id !== orgId) {
        throw new AppError(
          400,
          "Source document belongs to another organization",
        );
      }
    }

    const [template] = (await db("form_templates")
      .insert({
        org_id: orgId,
        created_by: user.id,
        source_document_id: input.source_document_id || null,
        name: input.name.trim(),
        status,
      })
      .returning("*")) as FormTemplateRow[];

    return mapTemplate(template);
  }

  async listTemplates(query: ListTemplatesQuery, user: AuthenticatedUser) {
    const { page, pageSize, offset } = getPaginationParams(
      query.page,
      query.pageSize,
    );

    const baseQuery = db("form_templates as t");

    if (user.role === "superadmin") {
      if (query.org_id) {
        baseQuery.andWhere("t.org_id", query.org_id);
      }
    } else {
      if (!user.orgId) {
        throw new AppError(
          400,
          "Authenticated user organization context is missing",
        );
      }

      baseQuery.andWhere("t.org_id", user.orgId);
    }

    if (query.status) {
      baseQuery.andWhere("t.status", query.status);
    }

    if (query.search) {
      baseQuery.andWhere("t.name", "ilike", `%${query.search}%`);
    }

    const rows = (await baseQuery
      .clone()
      .select("t.*")
      .orderBy("t.created_at", "desc")
      .offset(offset)
      .limit(pageSize)) as FormTemplateRow[];

    const countResult = (await baseQuery
      .clone()
      .clearSelect()
      .count({ count: "*" })
      .first()) as { count: string } | undefined;

    return {
      items: rows.map(mapTemplate),
      page,
      pageSize,
      total: Number(countResult?.count || 0),
    };
  }

  async getTemplateById(templateId: string, user: AuthenticatedUser) {
    const template = await getTemplateByIdInternal(templateId);

    if (!template) {
      throw new AppError(404, "Form template not found");
    }

    assertOrgScope(user, template.org_id);

    const versions = (await db("form_template_versions")
      .where({ template_id: template.id })
      .orderBy("version_no", "desc")) as FormTemplateVersionRow[];

    return {
      ...mapTemplate(template),
      versions: versions.map(mapVersion),
    };
  }

  async updateTemplate(
    templateId: string,
    input: UpdateTemplateInput,
    user: AuthenticatedUser,
  ) {
    const template = await getTemplateByIdInternal(templateId);

    if (!template) {
      throw new AppError(404, "Form template not found");
    }

    assertOrgScope(user, template.org_id);

    const payload: Record<string, unknown> = {};

    if (input.name !== undefined) {
      payload.name = input.name.trim();
    }

    if (input.status !== undefined) {
      if (!TEMPLATE_STATUSES.has(input.status)) {
        throw new AppError(400, "Invalid form template status");
      }
      payload.status = input.status;
    }

    if (Object.keys(payload).length === 0) {
      throw new AppError(400, "No form template values provided for update");
    }

    const [updatedTemplate] = (await db("form_templates")
      .where({ id: templateId })
      .update({
        ...payload,
        updated_at: new Date(),
      })
      .returning("*")) as FormTemplateRow[];

    return mapTemplate(updatedTemplate);
  }

  async deleteTemplate(templateId: string, user: AuthenticatedUser) {
    const template = await getTemplateByIdInternal(templateId);

    if (!template) {
      throw new AppError(404, "Form template not found");
    }

    assertOrgScope(user, template.org_id);

    const linkedSurvey = await db("surveys as s")
      .join("form_template_versions as v", "s.template_version_id", "v.id")
      .where("v.template_id", templateId)
      .first("s.id");

    if (linkedSurvey) {
      throw new AppError(409, "Cannot delete a template that already has survey submissions");
    }

    await db("form_templates").where({ id: templateId }).del();
    return { id: templateId };
  }

  async createVersion(
    templateId: string,
    input: CreateVersionInput,
    user: AuthenticatedUser,
  ) {
    const template = await getTemplateByIdInternal(templateId);

    if (!template) {
      throw new AppError(404, "Form template not found");
    }

    assertOrgScope(user, template.org_id);

    const status = input.status || "draft";
    if (!VERSION_STATUSES.has(status)) {
      throw new AppError(400, "Invalid version status for creation");
    }

    if (status === "published") {
      throw new AppError(400, "Use publish endpoint to publish a version");
    }

    const maxVersionResult = (await db("form_template_versions")
      .where({ template_id: template.id })
      .max<{ max: number | string | null }>("version_no as max")
      .first()) as { max: number | string | null } | undefined;

    const nextVersionNo = Number(maxVersionResult?.max || 0) + 1;

    return await db.transaction(async (trx) => {
      const [createdVersion] = (await trx("form_template_versions")
        .insert({
          template_id: template.id,
          version_no: nextVersionNo,
          status,
          is_published: false,
        })
        .returning("*")) as FormTemplateVersionRow[];

      let copiedFields = 0;
      if (input.copy_fields_from_version_id) {
        const sourceVersion = (await trx("form_template_versions")
          .where({
            id: input.copy_fields_from_version_id,
            template_id: template.id,
          })
          .first()) as FormTemplateVersionRow | undefined;

        if (!sourceVersion) {
          throw new AppError(404, "Source version for copy not found");
        }

        const sourceFields = (await trx("form_fields")
          .where({ template_version_id: sourceVersion.id })
          .orderBy("display_order", "asc")) as FormFieldRow[];

        if (sourceFields.length > 0) {
          await trx("form_fields").insert(
            sourceFields.map((field) => ({
              template_version_id: createdVersion.id,
              field_catalog_id: field.field_catalog_id,
              label: field.label,
              input_type: field.input_type,
              options_json: toJson(fromJson(field.options_json)),
              is_required: field.is_required,
              display_order: field.display_order,
              is_custom: field.is_custom,
            })),
          );
        }

        copiedFields = sourceFields.length;
      }

      return {
        ...mapVersion(createdVersion),
        copiedFields,
      };
    });
  }

  async listTemplateVersions(templateId: string, user: AuthenticatedUser) {
    const template = await getTemplateByIdInternal(templateId);

    if (!template) {
      throw new AppError(404, "Form template not found");
    }

    assertOrgScope(user, template.org_id);

    const versions = (await db("form_template_versions")
      .where({ template_id: template.id })
      .orderBy("version_no", "desc")) as FormTemplateVersionRow[];

    return versions.map(mapVersion);
  }

  async getVersionById(versionId: string, user: AuthenticatedUser) {
    const versionWithTemplate = await getTemplateWithOrgByVersionId(versionId);

    if (!versionWithTemplate) {
      throw new AppError(404, "Form template version not found");
    }

    assertOrgScope(user, versionWithTemplate.template_org_id);

    const fields = (await db("form_fields")
      .where({ template_version_id: versionId })
      .orderBy("display_order", "asc")) as FormFieldRow[];

    return {
      ...mapVersion(versionWithTemplate),
      templateName: versionWithTemplate.template_name,
      fields: fields.map(mapField),
    };
  }

  async updateVersion(
    versionId: string,
    input: UpdateVersionInput,
    user: AuthenticatedUser,
  ) {
    const versionWithTemplate = await getTemplateWithOrgByVersionId(versionId);

    if (!versionWithTemplate) {
      throw new AppError(404, "Form template version not found");
    }

    assertOrgScope(user, versionWithTemplate.template_org_id);

    if (
      versionWithTemplate.is_published ||
      versionWithTemplate.status === "published"
    ) {
      throw new AppError(400, "Published versions are immutable");
    }

    if (!input.status) {
      throw new AppError(
        400,
        "No form template version fields provided for update",
      );
    }

    if (!VERSION_STATUSES.has(input.status)) {
      throw new AppError(
        400,
        "Invalid status update. Use publish endpoint to publish a version",
      );
    }

    if (input.status === "published") {
      throw new AppError(
        400,
        "Invalid status update. Use publish endpoint to publish a version",
      );
    }

    const [updatedVersion] = (await db("form_template_versions")
      .where({ id: versionId })
      .update({
        status: input.status,
        updated_at: new Date(),
      })
      .returning("*")) as FormTemplateVersionRow[];

    return mapVersion(updatedVersion);
  }

  async deleteVersion(versionId: string, user: AuthenticatedUser) {
    const versionWithTemplate = await getTemplateWithOrgByVersionId(versionId);

    if (!versionWithTemplate) {
      throw new AppError(404, "Form template version not found");
    }

    assertOrgScope(user, versionWithTemplate.template_org_id);

    if (versionWithTemplate.is_published || versionWithTemplate.status === "published") {
      throw new AppError(409, "Published versions cannot be deleted");
    }

    const linkedSurvey = await db("surveys").where({ template_version_id: versionId }).first("id");
    if (linkedSurvey) {
      throw new AppError(409, "Cannot delete a version that already has survey submissions");
    }

    await db("form_template_versions").where({ id: versionId }).del();
    return { id: versionId };
  }

  async addFieldToVersion(
    versionId: string,
    input: AddFieldInput,
    user: AuthenticatedUser,
  ) {
    const versionWithTemplate = await getTemplateWithOrgByVersionId(versionId);

    if (!versionWithTemplate) {
      throw new AppError(404, "Form template version not found");
    }

    assertOrgScope(user, versionWithTemplate.template_org_id);
    assertDraftVersion(versionWithTemplate);

    let fieldCatalog: FieldCatalogRow | undefined;
    if (input.field_catalog_id) {
      fieldCatalog = (await db("field_catalog")
        .where({ id: input.field_catalog_id })
        .first()) as FieldCatalogRow | undefined;

      if (!fieldCatalog) {
        throw new AppError(404, "Field catalog entry not found");
      }
    }

    const label = input.label || fieldCatalog?.name;
    const inputType = input.input_type || fieldCatalog?.input_type;

    if (!label || !inputType) {
      throw new AppError(
        400,
        "label and input_type are required when field_catalog_id is not provided",
      );
    }

    let displayOrder = input.display_order;
    if (displayOrder === undefined) {
      const maxDisplayResult = (await db("form_fields")
        .where({ template_version_id: versionId })
        .max<{ max: number | string | null }>("display_order as max")
        .first()) as { max: number | string | null } | undefined;

      displayOrder = Number(maxDisplayResult?.max || 0) + 1;
    }

    const [createdField] = (await db("form_fields")
      .insert({
        template_version_id: versionId,
        field_catalog_id: input.field_catalog_id || null,
        label,
        input_type: inputType,
        options_json: toJson(
          input.options_json !== undefined
            ? input.options_json
            : fromJson(fieldCatalog?.options_json),
        ),
        is_required: input.is_required ?? false,
        display_order: displayOrder,
        is_custom: input.is_custom ?? !input.field_catalog_id,
      })
      .returning("*")) as FormFieldRow[];

    return mapField(createdField);
  }

  async updateField(
    fieldId: string,
    input: UpdateFieldInput,
    user: AuthenticatedUser,
  ) {
    const fieldWithContext = await getFieldWithContext(fieldId);

    if (!fieldWithContext) {
      throw new AppError(404, "Form field not found");
    }

    assertOrgScope(user, fieldWithContext.template_org_id);
    assertDraftVersion({
      status: fieldWithContext.version_status,
      is_published: fieldWithContext.version_is_published,
    });

    if (input.field_catalog_id) {
      const catalog = await db("field_catalog")
        .where({ id: input.field_catalog_id })
        .first();
      if (!catalog) {
        throw new AppError(404, "Field catalog entry not found");
      }
    }

    const payload: Record<string, unknown> = {};

    if (input.field_catalog_id !== undefined) {
      payload.field_catalog_id = input.field_catalog_id;
    }

    if (input.label !== undefined) {
      payload.label = input.label;
    }

    if (input.input_type !== undefined) {
      payload.input_type = input.input_type;
    }

    if (input.options_json !== undefined) {
      payload.options_json = toJson(input.options_json);
    }

    if (input.is_required !== undefined) {
      payload.is_required = input.is_required;
    }

    if (input.display_order !== undefined) {
      payload.display_order = input.display_order;
    }

    if (input.is_custom !== undefined) {
      payload.is_custom = input.is_custom;
    }

    if (Object.keys(payload).length === 0) {
      throw new AppError(400, "No form field values provided for update");
    }

    const [updatedField] = await db.transaction(async (trx) => {
      if (
        input.display_order !== undefined &&
        input.display_order !== fieldWithContext.display_order
      ) {
        const siblingFields = (await trx("form_fields")
          .where({ template_version_id: fieldWithContext.template_version_id })
          .orderBy("display_order", "asc")) as FormFieldRow[];

        const targetPosition = Math.max(1, input.display_order);
        const reorderedIds = siblingFields
          .filter((field) => field.id !== fieldId)
          .map((field) => field.id);
        reorderedIds.splice(
          Math.min(targetPosition - 1, reorderedIds.length),
          0,
          fieldId,
        );

        for (let index = 0; index < reorderedIds.length; index += 1) {
          await trx("form_fields")
            .where({ id: reorderedIds[index] })
            .update({
              display_order: index + 1,
              updated_at: new Date(),
            });
        }

        delete payload.display_order;
      }

      return (await trx("form_fields")
        .where({ id: fieldId })
        .update({
          ...payload,
          updated_at: new Date(),
        })
        .returning("*")) as FormFieldRow[];
    });

    return mapField(updatedField);
  }

  async deleteField(fieldId: string, user: AuthenticatedUser) {
    const fieldWithContext = await getFieldWithContext(fieldId);

    if (!fieldWithContext) {
      throw new AppError(404, "Form field not found");
    }

    assertOrgScope(user, fieldWithContext.template_org_id);
    assertDraftVersion({
      status: fieldWithContext.version_status,
      is_published: fieldWithContext.version_is_published,
    });

    await db("form_fields").where({ id: fieldId }).del();
    return { id: fieldId };
  }

  async publishVersion(versionId: string, user: AuthenticatedUser) {
    const versionWithTemplate = await getTemplateWithOrgByVersionId(versionId);

    if (!versionWithTemplate) {
      throw new AppError(404, "Form template version not found");
    }

    assertOrgScope(user, versionWithTemplate.template_org_id);

    const fieldCountResult = (await db("form_fields")
      .where({ template_version_id: versionId })
      .count<{ count: string }>("*")
      .first()) as { count: string } | undefined;

    if (Number(fieldCountResult?.count || 0) === 0) {
      throw new AppError(400, "Cannot publish a version without fields");
    }

    await db.transaction(async (trx) => {
      await trx("form_template_versions")
        .where({
          template_id: versionWithTemplate.template_id,
          is_published: true,
        })
        .update({
          is_published: false,
          status: "archived",
          updated_at: new Date(),
        });

      await trx("form_template_versions").where({ id: versionId }).update({
        is_published: true,
        status: "published",
        updated_at: new Date(),
      });

      await trx("form_templates")
        .where({ id: versionWithTemplate.template_id })
        .update({
          status: "active",
          updated_at: new Date(),
        });
    });

    const published = (await db("form_template_versions")
      .where({ id: versionId })
      .first()) as FormTemplateVersionRow | undefined;

    if (!published) {
      throw new AppError(500, "Published version could not be loaded");
    }

    return mapVersion(published);
  }

  async createTemplateFromDocument(
    documentId: string,
    input: CreateTemplateFromDocumentInput,
    user: AuthenticatedUser,
  ) {
    const document = (await db("documents")
      .where({ id: documentId })
      .first()) as DocumentRow | undefined;

    if (!document) {
      throw new AppError(404, "Document not found");
    }

    assertOrgScope(user, document.org_id);

    let extractedFields = parseExtractionFields(
      document.extraction_result_json,
    );
    console.info(`\n============== FORM TEMPLATE CREATION ==============`);
    console.info(
      `[FormBuilder] NGO requested new Form Template from uploaded blank document`,
    );
    console.info(
      `[FormBuilder] Document ID: ${document.id} | File Name: ${document.file_name}`,
    );
    console.info(
      `[FormBuilder] Raw extraction fields parsed: ${extractedFields.length}`,
    );
    console.info(`====================================================\n`);

    if (extractedFields.length === 0) {
      const rawExtraction = fromJson(document.extraction_result_json) as {
        extracted_fields?: string[];
      } | null;

      if (rawExtraction?.extracted_fields?.length) {
        const extractedKeys = rawExtraction.extracted_fields
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean);

        if (extractedKeys.length > 0) {
          const catalogRows = (await db("field_catalog")
            .whereIn("key", extractedKeys)
            .select(
              "id",
              "key",
              "name",
              "input_type",
              "options_json",
            )) as FieldCatalogRow[];

          const catalogByKey = new Map(
            catalogRows.map((row) => [row.key, row]),
          );

          extractedFields = extractedKeys.map((key) => {
            const catalog = catalogByKey.get(key);

            if (catalog) {
              return {
                label: catalog.name,
                inputType: catalog.input_type,
                options: fromJson(catalog.options_json),
                required: false,
                fieldCatalogId: catalog.id,
                isCustom: false,
              };
            }

            return {
              label: humanizeKey(key),
              inputType: "text",
              options: null,
              required: false,
              fieldCatalogId: null,
              isCustom: true,
            };
          });
        }
      }
    }

    if (extractedFields.length === 0) {
      console.warn("No extraction fields found in document result", {
        documentId: document.id,
        extractionKeys:
          typeof document.extraction_result_json === "string"
            ? Object.keys(
                (fromJson(document.extraction_result_json) as Record<
                  string,
                  unknown
                >) || {},
              )
            : Object.keys(
                (document.extraction_result_json as Record<string, unknown>) ||
                  {},
              ),
      });
      throw new AppError(
        400,
        "No extraction fields available in document extraction result",
      );
    }

    const requestedCatalogIds = Array.from(
      new Set(
        extractedFields
          .map((field) => field.fieldCatalogId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const existingCatalogRows = requestedCatalogIds.length
      ? ((await db("field_catalog")
          .whereIn("id", requestedCatalogIds)
          .select("id")) as {
          id: string;
        }[])
      : [];
    const existingCatalogIds = new Set(
      existingCatalogRows.map((row) => row.id),
    );

    const normalizedFields = extractedFields.map((field) => {
      const fieldCatalogId =
        field.fieldCatalogId && existingCatalogIds.has(field.fieldCatalogId)
          ? field.fieldCatalogId
          : null;

      return {
        label: field.label,
        inputType: field.inputType,
        options: field.options,
        required: field.required,
        fieldCatalogId,
        isCustom: fieldCatalogId ? false : true,
      };
    });

    const result = await db.transaction(async (trx) => {
      const templateName =
        input.name?.trim() || `Draft from ${document.file_name}`;

      const [template] = (await trx("form_templates")
        .insert({
          org_id: document.org_id,
          created_by: user.id,
          source_document_id: document.id,
          name: templateName,
          status: "draft",
        })
        .returning("*")) as FormTemplateRow[];

      const [version] = (await trx("form_template_versions")
        .insert({
          template_id: template.id,
          version_no: 1,
          status: "draft",
          is_published: false,
        })
        .returning("*")) as FormTemplateVersionRow[];

      const insertedFields = normalizedFields.length
        ? ((await trx("form_fields")
            .insert(
              normalizedFields.map((field, index) => ({
                template_version_id: version.id,
                field_catalog_id: field.fieldCatalogId,
                label: field.label,
                input_type: field.inputType,
                options_json: toJson(field.options),
                is_required: field.required,
                display_order: index + 1,
                is_custom: field.isCustom,
              })),
            )
            .returning("*")) as FormFieldRow[])
        : [];

      return {
        template: mapTemplate(template),
        version: mapVersion(version),
        fields: insertedFields.map(mapField),
      };
    });

    return {
      ...result,
      summary: {
        totalFieldsCreated: result.fields.length,
        customFields: result.fields.filter((field) => field.isCustom).length,
        catalogMappedFields: result.fields.filter((field) => !field.isCustom)
          .length,
      },
    };
  }
}

export const formTemplatesService = new FormTemplatesService();
