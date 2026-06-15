import { buildAuthHeaders } from "../features/auth/authSession";
import type { ApiEnvelope, ApiMeta, Paginated } from "../types/api";
import Constants from 'expo-constants';
import { Platform } from 'react-native';

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

  // EXPO_PUBLIC_API_BASE_URL may be:
  //   - An absolute URL like "http://192.168.1.x:8080/api"  <-- set this for APK builds!
  //   - A relative path like "/api"  <-- only works in Expo Go via metro proxy
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "/api";

  // If the env var is already absolute, use it directly (APK / standalone build)
  if (isAbsoluteUrl(envUrl)) {
    const base = envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  // Not absolute — running in Expo Go or web; auto-detect the LAN IP from metro hostUri
  let host = 'localhost';

  if (typeof location !== 'undefined' && location.hostname) {
    // Web browser: use window.location.hostname to avoid CORS issues
    host = location.hostname;
  } else {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      // Expo Go: hostUri is "192.168.x.x:19000", extract the IP portion
      host = hostUri.split(':')[0];
      console.log(`[API] Auto-detected LAN host from hostUri: ${host}`);
    } else if (Platform.OS === 'android') {
      // Android emulator loopback
      host = '10.0.2.2';
      console.warn('[API] hostUri not available. Using Android emulator fallback 10.0.2.2. For a real device APK, set EXPO_PUBLIC_API_BASE_URL to an absolute URL (e.g. http://192.168.x.x:8080/api)');
    } else {
      console.warn('[API] hostUri not available. Using localhost. Requests will fail on a physical device. Set EXPO_PUBLIC_API_BASE_URL to an absolute URL.');
    }
  }

  const baseUrl = `http://${host}:8080${envUrl}`;
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
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
  const hasToken = Object.keys(authHeaders).length > 0;
  for (const [key, value] of Object.entries(authHeaders)) {
    headers.set(key, value);
  }

  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const fullUrl = buildUrl(path);
  console.log(`\n[API REQUEST] ${options.method ?? "GET"} ${fullUrl}`);
  console.log(`[API AUTH] Token present: ${hasToken}`);
  if (!hasToken) {
    console.warn(`[API AUTH WARNING] No Bearer token attached for ${path}. User may not be logged in yet.`);
  }
  if (options.body !== undefined) {
    console.log(`[API REQUEST BODY]`, options.body instanceof FormData ? 'FormData' : options.body);
  }

  let response: Response;
  try {
    response = await fetch(fullUrl, {
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
  } catch (error: any) {
    console.error(`[API NETWORK ERROR] ${options.method ?? "GET"} ${fullUrl}`, error);

    if (error && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError("Unable to reach the API server.", 0, error);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : null;

  console.log(`[API RESPONSE] ${response.status} ${response.statusText} for ${fullUrl}`);

  if (!response.ok) {
    if (response.status !== 404) {
      console.error(`[API ERROR PAYLOAD]`, payload);
    } else {
      console.log(`[API 404 PAYLOAD]`, payload);
    }
    throw new ApiError(
      payload?.message ?? response.statusText ?? "Request failed",
      response.status,
      payload?.details,
    );
  }

  if (!payload) {
    console.warn(`[API WARNING] Empty response for ${fullUrl}`);
    throw new ApiError("API returned an empty response", response.status);
  }

  console.log(`[API SUCCESS PAYLOAD]`, JSON.stringify(payload).slice(0, 200) + '...');
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
  uploadToSignedUrl: async (url: string, file: any, headers?: Record<string, string>) => {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!response.ok) {
      throw new ApiError("Signed upload failed", response.status);
    }
  },
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
