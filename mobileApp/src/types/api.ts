export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: "superadmin" | "ngo_admin" | "field_worker" | "volunteer";
  status: "active" | "suspended" | "pending";
  organizationId?: string;
  organizationName?: string;
}

export interface ApiMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: ApiMeta;
}

export interface Paginated<T> {
  items: T[];
  meta: ApiMeta;
}
