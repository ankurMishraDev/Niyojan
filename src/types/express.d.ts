import type { AuthenticatedClaims, ResolvedAppUser } from "./auth";

declare global {
  namespace Express {
    interface Request {
      authClaims?: AuthenticatedClaims;
      user?: ResolvedAppUser;
    }
  }
}

export {};
