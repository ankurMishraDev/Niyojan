import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { geoService } from "./geo.service";

class GeoController {
  getMapPoints = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, "Authentication is required");
      }

      // Parse and validate types
      const typesParam = req.query.types as string | undefined;
      const validTypes = ["survey", "need", "aggregate_need", "volunteer"] as const;
      type PointType = (typeof validTypes)[number];

      let selectedTypes: PointType[] = [...validTypes];
      if (typesParam) {
        const requested = typesParam.split(",").map((t) => t.trim().toLowerCase());
        for (const t of requested) {
          if (!validTypes.includes(t as PointType)) {
            throw new AppError(400, `Invalid point type: ${t}. Valid values: ${validTypes.join(", ")}`);
          }
        }
        selectedTypes = requested as PointType[];
      }

      // Parse and validate bbox
      const bboxParam = req.query.bbox as string | undefined;
      let bbox: [number, number, number, number] | null = null;
      if (bboxParam) {
        const parts = bboxParam.split(",").map(Number);
        if (parts.length !== 4 || parts.some(Number.isNaN)) {
          throw new AppError(400, 'bbox must be "minLng,minLat,maxLng,maxLat" with numeric values');
        }
        bbox = parts as [number, number, number, number];
      }

      const result = await geoService.getMapPoints({
        user: req.user,
        types: selectedTypes,
        bbox,
        status: req.query.status as string | undefined,
        category: req.query.category as string | undefined,
      });

      return sendSuccess(res, result, "Map points retrieved");
    } catch (error) {
      next(error);
    }
  };
}

export const geoController = new GeoController();
