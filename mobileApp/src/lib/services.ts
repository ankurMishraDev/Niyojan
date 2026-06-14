import { api } from "./api";
import type { UserProfile, Paginated } from "../types/api";

export const authApi = {
  me: async () => {
    const res = await api.get<UserProfile>("/auth/me");
    return res.data;
  },
};

export const dashboardApi = {
  submittedSurveys: async (query?: { priority?: string; case_status?: string }) => {
    const res = await api.get<any[]>("/dashboard/submitted-surveys", query);
    return res.data;
  },
};

export const fieldCatalogApi = {
  list: async (query?: Record<string, unknown>) => {
    const res = await api.get<any[]>("/field-catalog", query);
    return api.paginated(res);
  },
};

export const formsApi = {
  listTemplates: async (query: { page: number; pageSize: number; status?: string }) => {
    const res = await api.get<any[]>("/form-templates", query);
    return api.paginated(res);
  },
  createTemplate: async (payload: { name: string; description?: string; fields?: any[] }) => {
    const res = await api.post<any>("/form-templates", payload);
    return res.data;
  },
  updateTemplate: async (id: string, payload: { name: string }) => {
    const res = await api.patch<any>(`/form-templates/${id}`, payload);
    return res.data;
  },
  deleteTemplate: async (id: string) => {
    await api.delete(`/form-templates/${id}`);
  },
  listVersions: async (templateId: string) => {
    const res = await api.get<any[]>(`/form-templates/${templateId}/versions`);
    return res.data;
  },
  createVersion: async (templateId: string, payload: any) => {
    const res = await api.post<any>(`/form-templates/${templateId}/versions`, payload);
    return res.data;
  },
  getVersion: async (versionId: string) => {
    const res = await api.get<any>(`/form-template-versions/${versionId}`);
    return res.data;
  },
  publishVersion: async (versionId: string) => {
    const res = await api.post<any>(`/form-template-versions/${versionId}/publish`, {});
    return res.data;
  },
  deleteVersion: async (versionId: string) => {
    await api.delete(`/form-template-versions/${versionId}`);
  },
  addField: async (versionId: string, payload: any) => {
    const res = await api.post<any>(`/form-template-versions/${versionId}/fields`, payload);
    return res.data;
  },
  updateField: async (fieldId: string, payload: any) => {
    const res = await api.patch<any>(`/form-fields/${fieldId}`, payload);
    return res.data;
  },
  deleteField: async (fieldId: string) => {
    await api.delete(`/form-fields/${fieldId}`);
  },
  createFromDocument: async (documentId: string, payload: { name: string }) => {
    const res = await api.post<any>(`/form-templates/from-document/${documentId}`, payload);
    return res.data;
  },
};

export const documentsApi = {
  uploadUrl: async (payload: { file_name: string; file_type: string }) => {
    const res = await api.post<any>("/documents/upload-url", payload);
    return res.data;
  },
  create: async (payload: any) => {
    const res = await api.post<any>("/documents", payload);
    return res.data;
  },
  extract: async (id: string, language: string) => {
    const res = await api.post<any>(`/documents/${id}/extract-fields`, { targetLanguage: language });
    return res.data;
  },
  get: async (id: string) => {
    const res = await api.get<any>(`/documents/${id}`);
    return res.data;
  },
};

export const pipelineApi = {
  status: async (id: string) => {
    const res = await api.get<any>(`/documents/${id}/pipeline-status`);
    return res.data;
  },
};

export const surveysApi = {
  create: async (payload: any) => {
    const res = await api.post<any>("/surveys", payload);
    return res.data;
  },
  get: async (id: string) => {
    const res = await api.get<any>(`/surveys/${id}`);
    return res.data;
  },
  submit: async (id: string, payload: any) => {
    const res = await api.post<any>(`/surveys/${id}/submit`, payload);
    return res.data;
  }
};

export const assignmentsApi = {
  list: async (query: { page: number; pageSize: number }) => {
    const res = await api.get<any[]>("/assignments", query);
    return api.paginated(res);
  },
  get: async (id: string) => {
    const res = await api.get<any>(`/assignments/${id}`);
    return res.data;
  },
  updateStatus: async (id: string, status: string) => {
    const res = await api.patch<any>(`/assignments/${id}/status`, { status });
    return res.data;
  },
};

export const feedbackApi = {
  get: async (assignmentId: string) => {
    const res = await api.get<any>(`/assignments/${assignmentId}/feedback`);
    return res.data;
  },
  submit: async (assignmentId: string, payload: Record<string, unknown>) => {
    const res = await api.post<any>(`/assignments/${assignmentId}/feedback`, payload);
    return res.data;
  },
  evidenceUrl: async (assignmentId: string, payload: { file_name: string; file_type: string }) => {
    const res = await api.post<any>(`/assignments/${assignmentId}/feedback/evidence-url`, payload);
    return res.data;
  },
};

