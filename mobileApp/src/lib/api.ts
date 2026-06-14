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

  // Use the env var. Default to "/api" if none is provided.
  let baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "/api";
  
  if (!isAbsoluteUrl(baseUrl)) {
    let host = 'localhost';
    
    // Auto-detect the development LAN IP
    if (typeof location !== 'undefined' && location.hostname) {
      // If we are running on web, we must use exactly the same hostname as the browser
      // Otherwise we'll hit CORS issues
      host = location.hostname;
    } else {
      const hostUri = Constants.expoConfig?.hostUri;
      if (hostUri) {
        host = hostUri.split(':')[0];
      } else if (Platform.OS === 'android') {
        host = '10.0.2.2'; // Safe fallback for local emulator
      }
    }
    
    // Backend API_PREFIX is /api (no /v1 segment).
    // e.g. http://localhost:8080/api/auth/me returns 401 (requires token)
    //      http://localhost:8080/api/v1/auth/me returns 404 (route not found)
    baseUrl = `http://${host}:8080${baseUrl}`; 
  }

  // Construct the final URL
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
    console.log(`\n[API REQUEST] ${options.method ?? "GET"} ${buildUrl(path)}`);
    if (options.body !== undefined) {
      console.log(`[API REQUEST BODY]`, options.body instanceof FormData ? 'FormData' : options.body);
    }
    
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
  } catch (error: any) {
    console.error(`[API NETWORK ERROR] ${options.method ?? "GET"} ${buildUrl(path)}`, error);
    
    if (error && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError("Unable to reach the API server.", 0, error);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : null;

  console.log(`[API RESPONSE] ${response.status} ${response.statusText} for ${buildUrl(path)}`);
  
      if (!response.ok) {
        if (response.status !== 404) {
          console.error(`[API ERROR PAYLOAD]`, payload);
        } else {
          // just log the 404 quietly instead of using console.warn to avoid Redboxes
          console.log(`[API 404 PAYLOAD]`, payload);
        }
        throw new ApiError(
          payload?.message ?? response.statusText ?? "Request failed",
          response.status,
          payload?.details,
        );
      }

  if (!payload) {
    console.warn(`[API WARNING] Empty response for ${buildUrl(path)}`);
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
    // In React Native, fetch can take a Blob or we can send the local URI using XMLHttpRequest / fetch.
    // For large files on mobile, we can use the fetch API passing the URI in a formData or sending it directly if possible.
    // To send exactly as PUT raw binary from a local URI:
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file, // file object fetched via fetch(uri).blob() usually
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