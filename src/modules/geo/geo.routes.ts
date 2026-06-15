import { Router } from "express";
import { z } from "zod";
import { allowRoles } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { geoController } from "./geo.controller";

const geoRouter = Router();

const VALID_POINT_TYPES = ["survey", "need", "aggregate_need", "volunteer"] as const;

const mapQuerySchema = z.object({
  types: z.string().optional(),
  bbox: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
});

const GEO_ROLES = ["superadmin", "ngo_admin", "field_worker"] as const;

geoRouter.get(
  "/map",
  allowRoles([...GEO_ROLES]),
  validate({ query: mapQuerySchema }),
  geoController.getMapPoints,
);

export default geoRouter;
