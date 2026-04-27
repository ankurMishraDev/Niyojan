import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";
import { clearDevMockSession, setDevMockSession } from "@/features/auth/authSession";

describe("api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearDevMockSession();
  });

  it("attaches mock headers and parses envelopes", async () => {
    setDevMockSession({
      userId: "user-1",
      orgId: "org-1",
      role: "ngo_admin",
      firebaseUid: "firebase-user-1",
    });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          message: "OK",
          data: { id: "123" },
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    const result = await api.get<{ id: string }>("/auth/me");

    expect(result.data.id).toBe("123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1];
    expect((request?.headers as Headers).get("x-mock-role")).toBe("ngo_admin");
  });

  it("throws ApiError on failed responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          message: "Unauthorized request",
          details: { reason: "token" },
          timestamp: new Date().toISOString(),
        }),
        {
          status: 401,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    await expect(api.get("/auth/me")).rejects.toBeInstanceOf(ApiError);
  });
});
