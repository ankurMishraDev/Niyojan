import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const checkDbHealth = vi.fn();

vi.mock("../src/config/db", () => ({
	checkDbHealth,
}));

describe("app health routes", () => {
	beforeEach(() => {
		checkDbHealth.mockReset();
	});

	it("returns service health", async () => {
		checkDbHealth.mockResolvedValue(undefined);
		const { app } = await import("../src/app");
		const response = await request(app).get("/health");

		expect(response.status).toBe(200);
		expect(response.body.success).toBe(true);
		expect(response.body.data.service).toBe("niyojan-backend");
	});
});
