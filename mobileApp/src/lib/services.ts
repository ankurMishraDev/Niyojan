import { api } from "./api";
import type { UserProfile, Paginated } from "../types/api";

export const authApi = {
  me: async () => {
    const res = await api.get<UserProfile>("/v1/auth/me");
    return res.data;
  },
};

export const dashboardApi = {
  submittedSurveys: async (query?: { priority?: string; case_status?: string }) => {
    const res = await api.get<any[]>("/v1/dashboard/submitted-surveys", query);
    return res.data;
  },
};

export const formsApi = {
  listTemplates: async (query: { page: number; pageSize: number; status?: string }) => {
    const res = await api.get<any[]>("/v1/forms/templates", query);
    return api.paginated(res);
  },
  createTemplate: async (payload: { name: string; description?: string; fields?: any[] }) => {
    const res = await api.post<any>("/v1/forms/templates", payload);
    return res.data;
  },
};

export const surveysApi = {
  submit: async (payload: any) => {
    const res = await api.post<any>("/v1/surveys", payload);
    return res.data;
  }
};

export const assignmentsApi = {
  list: async (query: { page: number; pageSize: number }) => {
    const res = await api.get<any[]>("/v1/assignments", query);
    return api.paginated(res);
  },
  get: async (id: string) => {
    const res = await api.get<any>(`/v1/assignments/${id}`);
    return res.data;
  },
  updateStatus: async (id: string, status: string) => {
    const res = await api.patch<any>(`/v1/assignments/${id}/status`, { status });
    return res.data;
  },
};

export const feedbackApi = {
  get: async (assignmentId: string) => {
    const res = await api.get<any>(`/v1/assignments/${assignmentId}/feedback`);
    return res.data;
  },
  submit: async (assignmentId: string, payload: Record<string, unknown>) => {
    const res = await api.post<any>(`/v1/assignments/${assignmentId}/feedback`, payload);
    return res.data;
  },
  evidenceUrl: async (assignmentId: string, payload: { file_name: string; file_type: string }) => {
    const res = await api.post<any>(`/v1/assignments/${assignmentId}/feedback/evidence-url`, payload);
    return res.data;
  },
};

