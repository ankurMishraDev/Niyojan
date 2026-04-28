import { NextFunction, Request, RequestHandler, Response } from "express";
import { getFirebaseAuth } from "../config/firebase";
import { authService } from "../modules/auth/auth.service";
import { UserStatus } from "../types/auth";
import { AppError } from "./errorHandler";

const ALL_STATUSES: UserStatus[] = ["pending", "active", "rejected", "inactive"];

const extractBearerToken = (authorization?: string) => {
	if (!authorization) {
		return null;
	}

	const [scheme, token] = authorization.split(" ");
	if (scheme?.toLowerCase() !== "bearer" || !token) {
		return null;
	}

	return token;
};

const ensureAuthClaims = (req: Request) => {
	if (!req.authClaims) {
		throw new AppError(401, "Authentication context is missing");
	}

	return req.authClaims;
};

export const requireAuth: RequestHandler = async (
	req: Request,
	_res: Response,
	next: NextFunction,
) => {
	try {
		if (req.authClaims) {
			return next();
		}

		const token = extractBearerToken(req.header("authorization"));
		if (!token) {
			throw new AppError(401, "Missing or invalid bearer token");
		}

		const decoded = await getFirebaseAuth().verifyIdToken(token);

		req.authClaims = {
			firebaseUid: decoded.uid,
			email: decoded.email,
			name: decoded.name,
			authSource: "firebase",
		};

		return next();
	} catch (error) {
		console.error("Authentication middleware error:", error);
		if (error instanceof AppError) {
			return next(error);
		}

		return next(new AppError(401, "Unauthorized request"));
	}
};

export const resolveAppUser = (options?: {
	allowMissing?: boolean;
	allowStatuses?: UserStatus[];
}): RequestHandler => {
	const allowedStatuses = options?.allowStatuses || ["active"];

	return async (req: Request, _res: Response, next: NextFunction) => {
		try {
			if (
				req.user &&
				(allowedStatuses.length === 0 ||
					allowedStatuses.includes((req.user.status as UserStatus) || "inactive"))
			) {
				return next();
			}

			const claims = ensureAuthClaims(req);
			const user = await authService.resolveUserFromClaims(claims);

			if (!user) {
				if (options?.allowMissing) {
					return next();
				}

				throw new AppError(404, "Application profile not found for authenticated identity", {
					code: "APP_PROFILE_NOT_FOUND",
				});
			}

			if (
				allowedStatuses.length > 0 &&
				!allowedStatuses.includes((user.status as UserStatus) || "inactive")
			) {
				throw new AppError(403, "This account is not active for operational access", {
					code: "ACCOUNT_NOT_ACTIVE",
					accountStatus: user.status,
					allowedStatuses,
				});
			}

			req.user = user;
			return next();
		} catch (error) {
			return next(error);
		}
	};
};

export const requireAnyResolvedUser = resolveAppUser({
	allowStatuses: ALL_STATUSES,
});
