import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	requireAuth,
	requireAuthAllowingUnverifiedEmail,
} from "../src/middleware/auth";
import { errorHandler } from "../src/middleware/errorHandler";

const verifyIdToken = vi.fn();

vi.mock("../src/config/firebase", () => ({
	getFirebaseAuth: () => ({
		verifyIdToken,
	}),
}));

describe("auth middleware email verification", () => {
	beforeEach(() => {
		verifyIdToken.mockReset();
	});

	it("rejects unverified Firebase tokens on protected routes", async () => {
		verifyIdToken.mockResolvedValue({
			uid: "firebase-user-1",
			email: "ngo@example.com",
			email_verified: false,
			name: "NGO User",
		});

		const app = express();
		app.get("/protected", requireAuth, (_req, res) => {
			res.status(200).json({ ok: true });
		});
		app.use(errorHandler);

		const response = await request(app)
			.get("/protected")
			.set("Authorization", "Bearer test-token");

		expect(response.status).toBe(403);
		expect(response.body.message).toBe("Email address is not verified");
		expect(response.body.details).toEqual({ code: "EMAIL_NOT_VERIFIED" });
	});

	it("allows unverified Firebase tokens on registration routes", async () => {
		verifyIdToken.mockResolvedValue({
			uid: "firebase-user-2",
			email: "volunteer@example.com",
			email_verified: false,
			name: "Volunteer User",
		});

		const app = express();
		app.post("/register", requireAuthAllowingUnverifiedEmail, (req, res) => {
			res.status(200).json({
				firebaseUid: req.authClaims?.firebaseUid,
				emailVerified: req.authClaims?.emailVerified,
			});
		});
		app.use(errorHandler);

		const response = await request(app)
			.post("/register")
			.set("Authorization", "Bearer test-token");

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			firebaseUid: "firebase-user-2",
			emailVerified: false,
		});
	});
});
