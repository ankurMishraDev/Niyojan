import { api } from "@/lib/api";
import type {
  Assignment,
  DashboardSummary,
  DocumentItem,
  Feedback,
  FieldCatalogItem,
  FormField,
  FormTemplate,
  FormTemplateVersion,
  MatchResult,
  Need,
  Paginated,
  PipelineManifest,
  PipelineHealth,
  PipelineStatus,
  ReviewPackage,
  SignedUpload,
  Survey,
  UrgentNeed,
  UserProfile,
  Volunteer,
  VolunteerAvailability,
} from "@/types/api";

export const authApi = {
  me: async () => (await api.get<UserProfile>("/auth/me")).data,
};

export const dashboardApi = {
  summary: async () => (await api.get<DashboardSummary>("/dashboard/summary")).data,
  urgentNeeds: async () => (await api.get<UrgentNeed[]>("/dashboard/urgent-needs")).data,
  volunteerAvailability: async () =>
    (await api.get<VolunteerAvailability>("/dashboard/volunteer-availability")).data,
  pipelineHealth: async () =>
    (await api.get<PipelineHealth>("/dashboard/pipeline-health")).data,
};

export const fieldCatalogApi = {
  list: async (query?: Record<string, unknown>) =>
    api.paginated<FieldCatalogItem>(await api.get<FieldCatalogItem[]>("/field-catalog", query)),
};

export const volunteersApi = {
  list: async (query?: Record<string, unknown>) =>
    api.paginated<Volunteer>(await api.get<Volunteer[]>("/volunteers", query)),
  get: async (id: string) => (await api.get<Volunteer>(`/volunteers/${id}`)).data,
  update: async (id: string, body: Record<string, unknown>) =>
    (await api.patch<Volunteer>(`/volunteers/${id}`, body)).data,
};

export const documentsApi = {
  list: async (query?: Record<string, unknown>) =>
    api.paginated<DocumentItem>(await api.get<DocumentItem[]>("/documents", query)),
  get: async (id: string) => (await api.get<DocumentItem>(`/documents/${id}`)).data,
  uploadUrl: async (body: Record<string, unknown>) =>
    (await api.post<SignedUpload>("/documents/upload-url", body)).data,
  create: async (body: Record<string, unknown>) =>
    (await api.post<DocumentItem>("/documents", body)).data,
  readUrl: async (id: string) =>
    (await api.get<{ readUrl: string; expiresAt: string }>(`/documents/${id}/read-url`)).data,
  updateStatus: async (id: string, status: string) =>
    (await api.patch<DocumentItem>(`/documents/${id}/status`, { status })).data,
  extract: async (id: string) =>
    (await api.post<Record<string, unknown>>(`/documents/${id}/extract-fields`)).data,
};

export const pipelineApi = {
  start: async (documentId: string) =>
    (await api.post<PipelineStatus>(`/documents/${documentId}/pipeline/start`)).data,
  status: async (documentId: string) =>
    (await api.get<PipelineStatus>(`/documents/${documentId}/pipeline/status`)).data,
  reviewPackage: async (documentId: string) =>
    (await api.get<ReviewPackage>(`/documents/${documentId}/review-package`)).data,
  submitReview: async (documentId: string, body: Record<string, unknown>) =>
    (await api.post<Record<string, unknown>>(`/documents/${documentId}/review`, body)).data,
  createForm: async (documentId: string, body: Record<string, unknown>) =>
    (await api.post<Record<string, unknown>>(`/documents/${documentId}/create-form`, body)).data,
  queue: async (query?: Record<string, unknown>) =>
    (await api.get<PipelineManifest[]>("/pipeline/queue", query)).data,
  manifest: async (id: string) =>
    (await api.get<PipelineManifest>(`/pipeline/manifests/${id}`)).data,
};

export const formsApi = {
  listTemplates: async (query?: Record<string, unknown>) =>
    api.paginated<FormTemplate>(await api.get<FormTemplate[]>("/form-templates", query)),
  getTemplate: async (id: string) => (await api.get<FormTemplate>(`/form-templates/${id}`)).data,
  listVersions: async (id: string) =>
    (await api.get<FormTemplateVersion[]>(`/form-templates/${id}/versions`)).data,
  getVersion: async (id: string) =>
    (await api.get<FormTemplateVersion>(`/form-template-versions/${id}`)).data,
  createVersion: async (id: string, body?: Record<string, unknown>) =>
    (await api.post<FormTemplateVersion>(`/form-templates/${id}/versions`, body)).data,
  addField: async (id: string, body: Record<string, unknown>) =>
    (await api.post<FormField>(`/form-template-versions/${id}/fields`, body)).data,
  updateField: async (id: string, body: Record<string, unknown>) =>
    (await api.patch<FormField>(`/form-fields/${id}`, body)).data,
  deleteField: async (id: string) => (await api.delete<{ id: string }>(`/form-fields/${id}`)).data,
  publishVersion: async (id: string) =>
    (await api.post<FormTemplateVersion>(`/form-template-versions/${id}/publish`)).data,
  createFromDocument: async (documentId: string, body?: Record<string, unknown>) =>
    (await api.post<Record<string, unknown>>(`/form-templates/from-document/${documentId}`, body)).data,
};

export const surveysApi = {
  list: async (query?: Record<string, unknown>) =>
    api.paginated<Survey>(await api.get<Survey[]>("/surveys", query)),
  create: async (body: Record<string, unknown>) => (await api.post<Survey>("/surveys", body)).data,
  get: async (id: string) => (await api.get<Survey>(`/surveys/${id}`)).data,
  submit: async (id: string, body: Record<string, unknown>) =>
    (await api.post<Survey>(`/surveys/${id}/submit`, body)).data,
  analyzeNeeds: async (id: string) =>
    (await api.post<{ survey: Survey; needs: Need[]; createdCount: number }>(`/surveys/${id}/analyze-needs`)).data,
};

export const needsApi = {
  list: async (query?: Record<string, unknown>) =>
    api.paginated<Need>(await api.get<Need[]>("/needs", query)),
  get: async (id: string) => (await api.get<Need>(`/needs/${id}`)).data,
  attachSkills: async (id: string, body: Record<string, unknown>) =>
    (await api.post<Need>(`/needs/${id}/skills`, body)).data,
};

export const matchingApi = {
  getMatches: async (needId: string) => (await api.get<MatchResult>(`/needs/${needId}/matches`)).data,
};

export const assignmentsApi = {
  list: async (query?: Record<string, unknown>) =>
    api.paginated<Assignment>(await api.get<Assignment[]>("/assignments", query)),
  get: async (id: string) => (await api.get<Assignment>(`/assignments/${id}`)).data,
  create: async (body: Record<string, unknown>) =>
    (await api.post<Assignment>("/assignments", body)).data,
  updateStatus: async (id: string, status: string) =>
    (await api.patch<Assignment>(`/assignments/${id}/status`, { status })).data,
};

export const feedbackApi = {
  get: async (assignmentId: string) =>
    (await api.get<Feedback>(`/assignments/${assignmentId}/feedback`)).data,
  submit: async (assignmentId: string, body: Record<string, unknown>) =>
    (await api.post<Feedback>(`/assignments/${assignmentId}/feedback`, body)).data,
  evidenceUrl: async (assignmentId: string, body: Record<string, unknown>) =>
    (await api.post<SignedUpload>(`/assignments/${assignmentId}/feedback/evidence-url`, body)).data,
  closeNeed: async (needId: string, body: Record<string, unknown>) =>
    (await api.post<Record<string, unknown>>(`/needs/${needId}/close`, body)).data,
};
