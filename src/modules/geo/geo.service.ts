import { db } from "../../config/db";
import { AuthenticatedUser } from "../../types/auth";

type PointType = "survey" | "need" | "aggregate_need" | "volunteer";

export type MapPoint = {
  type: PointType;
  id: string;
  lat: number;
  lng: number;
  label: string;
  category: string | null;
  urgency?: number;
  status?: string;
  count: number;
};

const INDIA_BOUNDS = {
  center: [22.5937, 78.9629] as [number, number],
  southWest: [6.55, 68.11] as [number, number],
  northEast: [37.10, 97.40] as [number, number],
};

// Valid lat/lng guard
function isValidCoord(lat: unknown, lng: unknown): boolean {
  const la = Number(lat);
  const lo = Number(lng);
  return Number.isFinite(la) && Number.isFinite(lo) && la >= -90 && la <= 90 && lo >= -180 && lo <= 180;
}

function applyBbox(
  query: ReturnType<typeof db>,
  latCol: string,
  lngCol: string,
  bbox: [number, number, number, number] | null,
) {
  if (!bbox) return query;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return query
    .whereBetween(lngCol, [minLng, maxLng])
    .whereBetween(latCol, [minLat, maxLat]);
}

type GeoServiceInput = {
  user: AuthenticatedUser;
  types: PointType[];
  bbox: [number, number, number, number] | null;
  status?: string;
  category?: string;
};

class GeoService {
  async getMapPoints(input: GeoServiceInput): Promise<{
    points: MapPoint[];
    counts: Record<PointType, number>;
    bounds: typeof INDIA_BOUNDS;
  }> {
    const { user, types, bbox, status, category } = input;
    const orgId = user.role === "superadmin" ? null : user.orgId;

    const points: MapPoint[] = [];

    // ─── surveys ─────────────────────────────────────────────────────────────
    if (types.includes("survey")) {
      let q = db("surveys")
        .whereNotNull("latitude")
        .whereNotNull("longitude");

      if (orgId) q = q.where("org_id", orgId);
      if (status) q = q.andWhere("status", status);
      q = applyBbox(q, "latitude", "longitude", bbox);

      const rows = await q.select("id", "respondent_name", "latitude", "longitude", "status");
      for (const row of rows) {
        if (!isValidCoord(row.latitude, row.longitude)) continue;
        points.push({
          type: "survey",
          id: row.id,
          lat: Number(row.latitude),
          lng: Number(row.longitude),
          label: row.respondent_name ?? "Survey",
          category: null,
          status: row.status,
          count: 1,
        });
      }
    }

    // ─── needs ───────────────────────────────────────────────────────────────
    if (types.includes("need")) {
      let q = db("needs_analysis as n")
        .join("surveys as s", "n.survey_id", "s.id")
        .whereNotNull("s.latitude")
        .whereNotNull("s.longitude");

      if (orgId) q = q.andWhere("n.org_id", orgId);
      if (status) q = q.andWhere("n.status", status);
      if (category) q = q.andWhere("n.category", category);
      q = applyBbox(q, "s.latitude", "s.longitude", bbox);

      const rows = await q.select(
        "n.id",
        "n.summary",
        "n.category",
        "n.urgency_score",
        "n.status",
        "s.latitude",
        "s.longitude",
      );

      for (const row of rows) {
        if (!isValidCoord(row.latitude, row.longitude)) continue;
        points.push({
          type: "need",
          id: row.id,
          lat: Number(row.latitude),
          lng: Number(row.longitude),
          label: (row.summary ?? "").slice(0, 80),
          category: row.category ?? null,
          urgency: Number(row.urgency_score),
          status: row.status,
          count: 1,
        });
      }
    }

    // ─── aggregate_needs ──────────────────────────────────────────────────────
    if (types.includes("aggregate_need")) {
      let q = db("aggregate_needs")
        .whereNotNull("centroid_lat")
        .whereNotNull("centroid_lng");

      if (orgId) q = q.andWhere("org_id", orgId);
      if (status) q = q.andWhere("status", status);
      if (category) q = q.andWhere("need_category", category);
      q = applyBbox(q, "centroid_lat", "centroid_lng", bbox);

      const rows = await q.select(
        "id",
        "title",
        "need_category",
        "urgency_score",
        "status",
        "centroid_lat",
        "centroid_lng",
        "member_count",
      );

      for (const row of rows) {
        if (!isValidCoord(row.centroid_lat, row.centroid_lng)) continue;
        points.push({
          type: "aggregate_need",
          id: row.id,
          lat: Number(row.centroid_lat),
          lng: Number(row.centroid_lng),
          label: row.title ?? "Cluster",
          category: row.need_category ?? null,
          urgency: Number(row.urgency_score),
          status: row.status,
          count: Number(row.member_count) || 1,
        });
      }
    }

    // ─── volunteers ───────────────────────────────────────────────────────────
    if (types.includes("volunteer")) {
      let q = db("volunteers as v")
        .join("users as u", "v.user_id", "u.id")
        .whereNotNull("v.latitude")
        .whereNotNull("v.longitude");

      if (orgId) q = q.andWhere("v.org_id", orgId);
      if (status) q = q.andWhere("v.availability_status", status);
      q = applyBbox(q, "v.latitude", "v.longitude", bbox);

      const rows = await q.select(
        "v.id",
        "v.latitude",
        "v.longitude",
        "v.availability_status",
        "u.name as user_name",
      );

      for (const row of rows) {
        if (!isValidCoord(row.latitude, row.longitude)) continue;
        points.push({
          type: "volunteer",
          id: row.id,
          lat: Number(row.latitude),
          lng: Number(row.longitude),
          label: row.user_name ?? "Volunteer",
          category: null,
          status: row.availability_status,
          count: 1,
        });
      }
    }

    // ─── Counts ───────────────────────────────────────────────────────────────
    const counts: Record<PointType, number> = {
      survey: 0, need: 0, aggregate_need: 0, volunteer: 0,
    };
    for (const p of points) {
      counts[p.type] = (counts[p.type] ?? 0) + 1;
    }

    return { points, counts, bounds: INDIA_BOUNDS };
  }
}

export const geoService = new GeoService();
