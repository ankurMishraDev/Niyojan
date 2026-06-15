import { Router } from "express";
import { z } from "zod";
import { allowRoles } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { matchingController } from "./matching.controller";

const matchingRouter = Router();

const MATCH_ROLES = ["superadmin", "ngo_admin"] as const;

const needIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const needTypeQuerySchema = z.object({
  type: z.enum(["need", "aggregate"]).optional(),
});

const assignBodySchema = z.object({
  needs: z
    .array(
      z.object({
        id: z.string().uuid(),
        type: z.enum(["need", "aggregate"]).default("need"),
        slots: z.number().int().positive().max(50).default(1),
      }),
    )
    .min(1),
  maxConcurrentPerVolunteer: z.number().int().positive().max(10).default(1),
  dryRun: z.boolean().default(true),
});

// GET /needs/:id/matches — now open to ngo_admin (was superadmin-only)
matchingRouter.get(
  "/needs/:id/matches",
  allowRoles([...MATCH_ROLES]),
  validate({ params: needIdParamsSchema, query: needTypeQuerySchema }),
  matchingController.getMatchesForNeed,
);

// POST /matching/assign — global greedy assignment
matchingRouter.post(
  "/matching/assign",
  allowRoles([...MATCH_ROLES]),
  validate({ body: assignBodySchema }),
  matchingController.proposeAssignment,
);

export default matchingRouter;
