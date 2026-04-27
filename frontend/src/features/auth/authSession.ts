import { env } from "@/lib/env";

const DEV_MOCK_KEY = "niyojan-dev-mock-session";

export type DevMockSession = {
  userId: string;
  orgId: string;
  role: string;
  firebaseUid: string;
  name?: string;
  email?: string;
};

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getDevMockSession = (): DevMockSession | null => {
  if (typeof window === "undefined" || !env.enableDevMockAuth) {
    return null;
  }

  const raw = window.localStorage.getItem(DEV_MOCK_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as DevMockSession;
  } catch {
    return null;
  }
};

export const setDevMockSession = (session: DevMockSession) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DEV_MOCK_KEY, JSON.stringify(session));
};

export const clearDevMockSession = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(DEV_MOCK_KEY);
};

export const defaultMockSession = (): DevMockSession => ({
  userId: env.mockUserId,
  orgId: env.mockOrgId,
  role: env.mockRole,
  firebaseUid: env.mockFirebaseUid,
});

export const buildAuthHeaders = () => {
  if (accessToken) {
    return {
      Authorization: `Bearer ${accessToken}`,
    };
  }

  const mock = getDevMockSession();
  if (!mock) {
    return {};
  }

  return {
    "x-mock-user-id": mock.userId,
    "x-mock-org-id": mock.orgId,
    "x-mock-role": mock.role,
    "x-mock-firebase-uid": mock.firebaseUid,
    ...(mock.email ? { "x-mock-email": mock.email } : {}),
    ...(mock.name ? { "x-mock-name": mock.name } : {}),
  };
};
