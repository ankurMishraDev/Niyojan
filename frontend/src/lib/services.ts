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
  PipelineIntakeItem,
  MatchResult,
  Need,
  NgoRegistrationPayload,
  OnboardingOrganization,
  VolunteerOnboardingOptions,
  VolunteerRegistrationPayload,
  PipelineManifest,
  PipelineHealth,
  PipelineStatus,
  ReviewPackage,
  SignedUpload,
  SubmittedSurveyCase,
  Survey,
  UrgentNeed,
  UserProfile,
  Volunteer,
  VolunteerAvailability,
} from "@/types/api";

export const authApi = {
  me: async () => (await api.get<UserProfile>("/auth/me")).data,
  registerNgo: async (body: NgoRegistrationPayload) =>
    (await api.post<UserProfile>("/auth/register-ngo", body)).data,
  volunteerOnboardingOptions: async () =>
    (await api.get<VolunteerOnboardingOptions>("/auth/volunteer-onboarding-options")).data,
  registerVolunteer: async (body: VolunteerRegistrationPayload) =>
    (await api.post<UserProfile>("/auth/register-volunteer", body)).data,
};

export const onboardingApi = {
  listNgos: async (query?: Record<string, unknown>) =>
    (await api.get<OnboardingOrganization[]>("/admin/onboarding/ngos", query))
      .data,
  approveNgo: async (orgId: string) =>
    (
      await api.post<{ orgId: string; status: string }>(
        `/admin/onboarding/ngos/${orgId}/approve`,
      )
    ).data,
  rejectNgo: async (orgId: string) =>
    (
      await api.post<{ orgId: string; status: string }>(
        `/admin/onboarding/ngos/${orgId}/reject`,
      )
    ).data,
};

export const dashboardApi = {
  summary: async () =>
    (await api.get<DashboardSummary>("/dashboard/summary")).data,
  urgentNeeds: async () =>
    (await api.get<UrgentNeed[]>("/dashboard/urgent-needs")).data,
  submittedSurveys: async (query?: Record<string, unknown>) =>
    (await api.get<SubmittedSurveyCase[]>("/dashboard/submitted-surveys", query)).data,
  volunteerAvailability: async () =>
    (await api.get<VolunteerAvailability>("/dashboard/volunteer-availability"))
      .data,
  pipelineHealth: async () =>
    (await api.get<PipelineHealth>("/dashboard/pipeline-health")).data,
};

export const fieldCatalogApi = {
  list: async (query?: Record<string, unknown>) =>
    api.paginated<FieldCatalogItem>(
      await api.get<FieldCatalogItem[]>("/field-catalog", query),
    ),
};

export const volunteersApi = {
  list: async (query?: Record<string, unknown>) =>
    api.paginated<Volunteer>(await api.get<Volunteer[]>("/volunteers", query)),
  get: async (id: string) =>
    (await api.get<Volunteer>(`/volunteers/${id}`)).data,
  update: async (id: string, body: Record<string, unknown>) =>
    (await api.patch<Volunteer>(`/volunteers/${id}`, body)).data,
};

export const documentsApi = {
  list: async (query?: Record<string, unknown>) =>
    api.paginated<DocumentItem>(
      await api.get<DocumentItem[]>("/documents", query),
    ),
  get: async (id: string) =>
    (await api.get<DocumentItem>(`/documents/${id}`)).data,
  uploadUrl: async (body: Record<string, unknown>) =>
    (await api.post<SignedUpload>("/documents/upload-url", body)).data,
  create: async (body: Record<string, unknown>) =>
    (await api.post<DocumentItem>("/documents", body)).data,
  delete: async (id: string) =>
    (await api.delete<{ id: string }>(`/documents/${id}`)).data,
  readUrl: async (id: string) =>
    (
      await api.get<{ readUrl: string; expiresAt: string }>(
        `/documents/${id}/read-url`,
      )
    ).data,
  updateStatus: async (id: string, status: string) =>
    (await api.patch<DocumentItem>(`/documents/${id}/status`, { status })).data,
  extract: async (id: string) =>
    (await api.post<Record<string, unknown>>(`/documents/${id}/extract-fields`))
      .data,
};

export const pipelineApi = {
  intake: async () => (await api.get<PipelineIntakeItem[]>("/pipeline/intake")).data,
  start: async (documentId: string) =>
    (await api.post<PipelineStatus>(`/documents/${documentId}/pipeline/start`))
      .data,
  status: async (documentId: string) =>
    (await api.get<PipelineStatus>(`/documents/${documentId}/pipeline/status`))
      .data,
  reviewPackage: async (documentId: string) =>
    (await api.get<ReviewPackage>(`/documents/${documentId}/review-package`))
      .data,
  surveyReviewPackage: async (surveyId: string) =>
    (await api.get<ReviewPackage>(`/surveys/${surveyId}/review-package`)).data,
  updateReviewAssessment: async (documentId: string, body: Record<string, unknown>) =>
    (await api.patch<Record<string, unknown>>(`/documents/${documentId}/review-assessment`, body)).data,
  updateSurveyReviewAssessment: async (surveyId: string, body: Record<string, unknown>) =>
    (await api.patch<Record<string, unknown>>(`/surveys/${surveyId}/review-assessment`, body)).data,
  submitReview: async (documentId: string, body: Record<string, unknown>) =>
    (
      await api.post<Record<string, unknown>>(
        `/documents/${documentId}/review`,
        body,
      )
    ).data,
  submitSurveyReview: async (surveyId: string, body: Record<string, unknown>) =>
    (await api.post<Record<string, unknown>>(`/surveys/${surveyId}/review`, body))
      .data,
  createForm: async (documentId: string, body: Record<string, unknown>) =>
    (
      await api.post<Record<string, unknown>>(
        `/documents/${documentId}/create-form`,
        body,
      )
    ).data,
  queue: async (query?: Record<string, unknown>) =>
    (await api.get<PipelineManifest[]>("/pipeline/queue", query)).data,
  manifest: async (id: string) =>
    (await api.get<PipelineManifest>(`/pipeline/manifests/${id}`)).data,
};

export const formsApi = {
  createTemplate: async (body: Record<string, unknown>) =>
    (await api.post<FormTemplate>("/form-templates", body)).data,
  listTemplates: async (query?: Record<string, unknown>) =>
    api.paginated<FormTemplate>(
      await api.get<FormTemplate[]>("/form-templates", query),
    ),
  getTemplate: async (id: string) =>
    (await api.get<FormTemplate>(`/form-templates/${id}`)).data,
  listVersions: async (id: string) =>
    (await api.get<FormTemplateVersion[]>(`/form-templates/${id}/versions`))
      .data,
  getVersion: async (id: string) =>
    (await api.get<FormTemplateVersion>(`/form-template-versions/${id}`)).data,
  createVersion: async (id: string, body?: Record<string, unknown>) =>
    (
      await api.post<FormTemplateVersion>(
        `/form-templates/${id}/versions`,
        body,
      )
    ).data,
  addField: async (id: string, body: Record<string, unknown>) =>
    (await api.post<FormField>(`/form-template-versions/${id}/fields`, body))
      .data,
  updateField: async (id: string, body: Record<string, unknown>) =>
    (await api.patch<FormField>(`/form-fields/${id}`, body)).data,
  deleteField: async (id: string) =>
    (await api.delete<{ id: string }>(`/form-fields/${id}`)).data,
  publishVersion: async (id: string) =>
    (
      await api.post<FormTemplateVersion>(
        `/form-template-versions/${id}/publish`,
      )
    ).data,
  createFromDocument: async (
    documentId: string,
    body?: Record<string, unknown>,
  ) =>
    (
      await api.post<{
        template: { id: string };
        version: { id: string };
        fields: Array<{ id: string }>;
        summary: Record<string, unknown>;
      }>(
        `/form-templates/from-document/${documentId}`,
        body,
      )
    ).data,
};

export const surveysApi = {
  list: async (query?: Record<string, unknown>) =>
    api.paginated<Survey>(await api.get<Survey[]>("/surveys", query)),
  create: async (body: Record<string, unknown>) =>
    (await api.post<Survey>("/surveys", body)).data,
  get: async (id: string) => (await api.get<Survey>(`/surveys/${id}`)).data,
  submit: async (id: string, body: Record<string, unknown>) =>
    (await api.post<Survey>(`/surveys/${id}/submit`, body)).data,
  analyzeNeeds: async (id: string) =>
    (await api.post<{ createdCount: number }>(`/surveys/${id}/analyze-needs`))
      .data,
  delete: async (id: string) =>
    (await api.delete<void>(`/surveys/${id}`)).data,
};

export const needsApi = {
  list: async (query?: Record<string, unknown>) =>
    api.paginated<Need>(await api.get<Need[]>("/needs", query)),
  get: async (id: string) => (await api.get<Need>(`/needs/${id}`)).data,
  attachSkills: async (id: string, body: Record<string, unknown>) =>
    (await api.post<Need>(`/needs/${id}/skills`, body)).data,
};

export const matchingApi = {
  getMatches: async (needId: string) =>
    (await api.get<MatchResult>(`/needs/${needId}/matches`)).data,
};

export const assignmentsApi = {
  list: async (query?: Record<string, unknown>) =>
    api.paginated<Assignment>(
      await api.get<Assignment[]>("/assignments", query),
    ),
  get: async (id: string) =>
    (await api.get<Assignment>(`/assignments/${id}`)).data,
  create: async (body: Record<string, unknown>) =>
    (await api.post<Assignment>("/assignments", body)).data,
  updateStatus: async (id: string, status: string) =>
    (await api.patch<Assignment>(`/assignments/${id}/status`, { status })).data,
};

export const feedbackApi = {
  get: async (assignmentId: string) =>
    (await api.get<Feedback>(`/assignments/${assignmentId}/feedback`)).data,
  submit: async (assignmentId: string, body: Record<string, unknown>) =>
    (await api.post<Feedback>(`/assignments/${assignmentId}/feedback`, body))
      .data,
  evidenceUrl: async (assignmentId: string, body: Record<string, unknown>) =>
    (
      await api.post<SignedUpload>(
        `/assignments/${assignmentId}/feedback/evidence-url`,
        body,
      )
    ).data,
  closeNeed: async (needId: string, body: Record<string, unknown>) =>
    (await api.post<Record<string, unknown>>(`/needs/${needId}/close`, body))
      .data,
};
