import { randomUUID } from "node:crypto";
import {
  deleteStoredObject,
  gcsBucketName,
  generateSignedReadUrl,
  generateSignedUploadUrl,
} from "../../config/gcp";
import { db } from "../../config/db";
import { jobService } from "../../jobs/job.service";
import { AppError } from "../../middleware/errorHandler";
import { AuthenticatedUser } from "../../types/auth";
import { getPaginationParams } from "../../utils/pagination";
import { aiOrchestratorService } from "../aiPipeline/aiOrchestrator.service";

type DocumentRow = {
  id: string;
  org_id: string;
  uploaded_by: string | null;
  source_survey_id: string | null;
  file_name: string;
  gcs_path: string;
  file_type: string;
  status: string;
  extraction_result_json: unknown;
  created_at: Date;
  updated_at: Date;
};

type CreateUploadUrlInput = {
  file_name: string;
  file_type: string;
  org_id?: string;
};

type CreateDocumentInput = {
  file_name: string;
  gcs_path: string;
  file_type: string;
  status?: string;
  org_id?: string;
  source_survey_id?: string;
};

type ListDocumentsQuery = {
  page?: string | number;
  pageSize?: string | number;
  org_id?: string;
  status?: string;
  file_type?: string;
  uploaded_by?: string;
  source_survey_id?: string;
};

type UpdateDocumentStatusInput = {
  status: "uploaded" | "processing" | "review_pending" | "approved" | "failed";
};

const DOCUMENT_STATUSES = new Set([
  "uploaded",
  "processing",
  "review_pending",
  "approved",
  "failed",
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

const sanitizeFileName = (fileName: string) => {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
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

const buildObjectPath = (orgId: string, fileName: string) => {
  const safeFileName = sanitizeFileName(fileName);
  return `orgs/${orgId}/documents/${Date.now()}-${randomUUID()}-${safeFileName}`;
};

const mapDocument = (document: DocumentRow) => {
  return {
    id: document.id,
    orgId: document.org_id,
    uploadedBy: document.uploaded_by,
    sourceSurveyId: document.source_survey_id,
    fileName: document.file_name,
    gcsPath: document.gcs_path,
    fileType: document.file_type,
    status: document.status,
    extractionResult: fromJson(document.extraction_result_json),
    createdAt: document.created_at,
    updatedAt: document.updated_at,
  };
};

const getDocumentRowById = async (documentId: string) => {
  return (await db("documents").where({ id: documentId }).first()) as
    | DocumentRow
    | undefined;
};

const getSurveyRowById = async (surveyId: string) => {
  return (await db("surveys")
    .where({ id: surveyId })
    .select("id", "org_id")
    .first()) as { id: string; org_id: string } | undefined;
};

export class DocumentsService {
  async createUploadUrl(input: CreateUploadUrlInput, user: AuthenticatedUser) {
    const orgId = resolveTargetOrgId(user, input.org_id);
    const gcsPath = buildObjectPath(orgId, input.file_name);

    const signed = await generateSignedUploadUrl(gcsPath, input.file_type);

    return {
      bucket: gcsBucketName,
      gcsPath,
      fileName: input.file_name,
      fileType: input.file_type,
      uploadUrl: signed.url,
      method: "PUT",
      expiresAt: signed.expiresAt,
      requiredHeaders: {
        "Content-Type": input.file_type,
      },
    };
  }

  async createDocument(input: CreateDocumentInput, user: AuthenticatedUser) {
    const orgId = resolveTargetOrgId(user, input.org_id);
    const status = input.status || "uploaded";

    if (!DOCUMENT_STATUSES.has(status)) {
      throw new AppError(400, "Invalid document status");
    }

    if (input.source_survey_id) {
      const survey = await getSurveyRowById(input.source_survey_id);
      if (!survey) {
        throw new AppError(404, "Source survey not found");
      }

      if (survey.org_id !== orgId) {
        throw new AppError(
          403,
          "Source survey belongs to another organization",
        );
      }
    }

    const [document] = (await db("documents")
      .insert({
        org_id: orgId,
        uploaded_by: user.id,
        source_survey_id: input.source_survey_id || null,
        file_name: input.file_name,
        gcs_path: input.gcs_path,
        file_type: input.file_type,
        status,
      })
      .returning("*")) as DocumentRow[];

    return mapDocument(document);
  }

  async listDocuments(query: ListDocumentsQuery, user: AuthenticatedUser) {
    const { page, pageSize, offset } = getPaginationParams(
      query.page,
      query.pageSize,
    );

    const baseQuery = db("documents as d");

    if (user.role === "superadmin") {
      if (query.org_id) {
        baseQuery.andWhere("d.org_id", query.org_id);
      }
    } else {
      if (!user.orgId) {
        throw new AppError(
          400,
          "Authenticated user organization context is missing",
        );
      }

      baseQuery.andWhere("d.org_id", user.orgId);
    }

    if (query.status) {
      baseQuery.andWhere("d.status", query.status);
    }

    if (query.file_type) {
      baseQuery.andWhere("d.file_type", query.file_type);
    }

    if (query.uploaded_by) {
      baseQuery.andWhere("d.uploaded_by", query.uploaded_by);
    }

    if (query.source_survey_id) {
      baseQuery.andWhere("d.source_survey_id", query.source_survey_id);
    }

    const rows = (await baseQuery
      .clone()
      .select("d.*")
      .orderBy("d.created_at", "desc")
      .offset(offset)
      .limit(pageSize)) as DocumentRow[];

    const countResult = (await baseQuery
      .clone()
      .clearSelect()
      .count({ count: "*" })
      .first()) as { count: string } | undefined;

    return {
      items: rows.map(mapDocument),
      page,
      pageSize,
      total: Number(countResult?.count || 0),
    };
  }

  async getDocumentById(documentId: string, user: AuthenticatedUser) {
    const document = await getDocumentRowById(documentId);

    if (!document) {
      throw new AppError(404, "Document not found");
    }

    assertOrgScope(user, document.org_id);
    return mapDocument(document);
  }

  async getDocumentReadUrl(documentId: string, user: AuthenticatedUser) {
    const document = await getDocumentRowById(documentId);

    if (!document) {
      throw new AppError(404, "Document not found");
    }

    assertOrgScope(user, document.org_id);

    const signed = await generateSignedReadUrl(document.gcs_path);
    return {
      documentId: document.id,
      gcsPath: document.gcs_path,
      readUrl: signed.url,
      expiresAt: signed.expiresAt,
    };
  }

  async updateDocumentStatus(
    documentId: string,
    input: UpdateDocumentStatusInput,
    user: AuthenticatedUser,
  ) {
    const document = await getDocumentRowById(documentId);

    if (!document) {
      throw new AppError(404, "Document not found");
    }

    assertOrgScope(user, document.org_id);

    if (!DOCUMENT_STATUSES.has(input.status)) {
      throw new AppError(400, "Invalid document status");
    }

    const [updatedDocument] = (await db("documents")
      .where({ id: documentId })
      .update({
        status: input.status,
        updated_at: new Date(),
      })
      .returning("*")) as DocumentRow[];

    return mapDocument(updatedDocument);
  }

  async triggerExtraction(documentId: string, user: AuthenticatedUser) {
    const document = await getDocumentRowById(documentId);

    if (!document) {
      throw new AppError(404, "Document not found");
    }

    assertOrgScope(user, document.org_id);

    if (document.status === "processing") {
      throw new AppError(409, "Document extraction is already in progress");
    }

    console.info(`\n============== DATA COLLECTION EXTRACTION ==============`);
    console.info(
      `[Document AI] NGO triggered data extraction for filled document!`,
    );
    console.info(
      `[Document AI] Document ID: ${document.id} | File Name: ${document.file_name}`,
    );
    console.info(`[Document AI] Starting AI orchestrator processing...`);

    await db("documents").where({ id: documentId }).update({
      status: "processing",
      updated_at: new Date(),
    });

    const job = await jobService.createJob({
      orgId: document.org_id,
      type: "document_field_extraction",
      entityType: "document",
      entityId: document.id,
      payload: {
        documentId: document.id,
        gcsPath: document.gcs_path,
      },
    });

    try {
      await jobService.markRunning(job.id as string);

      const extraction =
        await aiOrchestratorService.extractAndMapDocumentFields({
          documentId: document.id,
          gcsPath: document.gcs_path,
          fileName: document.file_name,
          fileType: document.file_type,
        });

      console.info(`\n[Document AI] Extract + Map complete. Details:`);
      console.info(`- Provider Used: ${extraction.documentAi.providerName}`);
      console.info(`- Raw AI Fields: ${extraction.documentAi.fields.length}`);
      console.info(`- Mapped Draft Fields: ${extraction.mappedFields.length}`);
      console.info(`[Document AI] Ready for draft hydration!`);
      console.info(`======================================================\n`);

      const [updatedDocument] = (await db("documents")
        .where({ id: document.id })
        .update({
          status: "review_pending",
          extraction_result_json: toJson(extraction),
          updated_at: new Date(),
        })
        .returning("*")) as DocumentRow[];

      await jobService.markCompleted(job.id as string, {
        documentId: document.id,
        candidateCount: extraction.summary.candidateCount,
        mappedCount: extraction.summary.mappedCount,
      });

      return {
        document: mapDocument(updatedDocument),
        job: {
          id: job.id,
          status: "completed",
          type: "document_field_extraction",
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown extraction error";
      console.error("Document extraction failed", {
        documentId: document.id,
        errorMessage,
      });

      await db("documents").where({ id: document.id }).update({
        status: "failed",
        updated_at: new Date(),
      });

      await jobService.markFailed(job.id as string, errorMessage);
      throw new AppError(500, `Document extraction failed: ${errorMessage}`);
    }
  }

  async deleteDocument(documentId: string, user: AuthenticatedUser) {
    const document = await getDocumentRowById(documentId);

    if (!document) {
      throw new AppError(404, "Document not found");
    }

    assertOrgScope(user, document.org_id);

    await deleteStoredObject(document.gcs_path);
    await db("documents").where({ id: documentId }).del();

    return { id: documentId };
  }
}

export const documentsService = new DocumentsService();
