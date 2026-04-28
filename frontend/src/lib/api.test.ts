import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";
import { setAccessToken } from "@/features/auth/authSession";

describe("api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken(null);
  });

  it("attaches bearer tokens and parses envelopes", async () => {
    setAccessToken("token-123");

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
    expect((request?.headers as Headers).get("Authorization")).toBe("Bearer token-123");
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
