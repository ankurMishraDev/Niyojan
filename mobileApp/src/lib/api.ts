import { buildAuthHeaders } from "../features/auth/authSession";
import type { ApiEnvelope, ApiMeta, Paginated } from "../types/api";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

const buildUrl = (path: string) => {
  if (isAbsoluteUrl(path)) {
    return path;
  }

  let baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "http://10.0.2.2:3000/api";
  
  if (baseUrl.startsWith('/')) {
    // Android emulator loopback alias
    baseUrl = `http://10.0.2.2:3000${baseUrl}`; 
  }

  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
};

const toQueryString = (query?: Record<string, unknown>) => {
  if (!query) {
    return "";
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    params.set(key, String(value));
  }

  const rendered = params.toString();
  return rendered ? `?${rendered}` : "";
};

async function requestOnce<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  const authHeaders = await buildAuthHeaders();
  for (const [key, value] of Object.entries(authHeaders)) {
    headers.set(key, value);
  }

  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined
          ? undefined
          : options.body instanceof FormData
            ? options.body
            : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError("Unable to reach the API server.", 0, error);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(
      payload?.message ?? response.statusText ?? "Request failed",
      response.status,
      payload?.details,
    );
  }

  if (!payload) {
    throw new ApiError("API returned an empty response", response.status);
  }

  return payload as ApiEnvelope<T>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const method = options.method ?? "GET";
  const maxAttempts = method === "GET" ? 3 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestOnce<T>(path, options);
    } catch (error) {
      const isRetryable =
        error instanceof ApiError &&
        method === "GET" &&
        (error.status === 0 || error.status >= 500);

      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }

      await delay(200 * attempt);
    }
  }

  throw new ApiError("Request failed after retrying", 0);
}

const paginated = <T>(envelope: ApiEnvelope<T[]>) => ({
  items: envelope.data,
  meta: envelope.meta ?? ({} satisfies ApiMeta),
}) satisfies Paginated<T>;

export const api = {
  get: <T>(path: string, query?: Record<string, unknown>, signal?: AbortSignal) =>
    request<T>(`${path}${toQueryString(query)}`, { signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: "POST", body, signal }),
  patch: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: "PATCH", body, signal }),
  delete: <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, { method: "DELETE", signal }),
  paginated,
};

export const getApiErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Request failed.";
};