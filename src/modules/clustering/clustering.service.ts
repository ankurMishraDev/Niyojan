import { Knex } from "knex";
import { db } from "../../config/db";
import { AppError } from "../../middleware/errorHandler";
import { Graph } from "./connectedComponents";
import { clusterScore } from "./clusterScore";
import { clusterGraph } from "./clusterGraph";

// ─── Helpers ────────────────────────────────────────────────────────────────

const toRadians = (value: number) => (value * Math.PI) / 180;

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function urgencyToLabel(score: number): string {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

type GeoPoint = { lat: number | null; lng: number | null };

function computeCentroid(members: GeoPoint[]): {
  lat: number | null;
  lng: number | null;
  radiusKm: number | null;
} {
  const geoPoints = members.filter(
    (m) => m.lat !== null && m.lng !== null,
  ) as { lat: number; lng: number }[];

  if (geoPoints.length === 0) {
    return { lat: null, lng: null, radiusKm: null };
  }

  const centLat = avg(geoPoints.map((p) => p.lat));
  const centLng = avg(geoPoints.map((p) => p.lng));

  const radiusKm = Math.max(
    0,
    ...geoPoints.map((p) => haversineKm(centLat, centLng, p.lat, p.lng)),
  );

  return { lat: centLat, lng: centLng, radiusKm: Number(radiusKm.toFixed(2)) };
}

async function rollupNeedSkills(
  trx: Knex.Transaction,
  aggregateNeedId: string,
  needIds: string[],
): Promise<void> {
  if (needIds.length === 0) return;

  const skillIds = await trx("need_skills")
    .whereIn("need_id", needIds)
    .distinct("skill_id")
    .pluck("skill_id") as string[];

  if (skillIds.length === 0) return;

  await trx("need_skills").insert(
    skillIds.map((skill_id) => ({
      aggregate_need_id: aggregateNeedId,
      need_id: null,
      skill_id,
    })),
  );
}

async function clusterSkillKeys(
  trx: Knex.Transaction,
  aggregateNeedId: string,
): Promise<string[]> {
  const rows = await trx("need_skills as ns")
    .join("skills as s", "ns.skill_id", "s.id")
    .where("ns.aggregate_need_id", aggregateNeedId)
    .select("s.key");
  return rows.map((r: { key: string }) => r.key);
}

function mapAggregateResponse(aggregate: Record<string, unknown>, requiredSkills: string[]) {
  return {
    id: aggregate.id,
    orgId: aggregate.org_id,
    title: aggregate.title,
    needCategory: aggregate.need_category,
    urgencyLabel: aggregate.urgency_label,
    urgencyScore: aggregate.urgency_score,
    centroidLat: aggregate.centroid_lat,
    centroidLng: aggregate.centroid_lng,
    radiusKm: aggregate.radius_km,
    memberCount: aggregate.member_count,
    clusterScore: aggregate.cluster_score,
    status: aggregate.status,
    requiredSkills,
  };
}

// ─── Default policy ──────────────────────────────────────────────────────────

const DEFAULT_POLICY = {
  category_weight: 0.4,
  location_weight: 0.3,
  time_weight: 0.15,
  semantic_weight: 0.15,
  threshold: 0.72,
  max_cluster_size: 15,
  time_window_days: 14,
  radius_km_hard_cap: 10.0,
};

// ─── Types ───────────────────────────────────────────────────────────────────

export type ManualClusterInput = {
  orgId: string | null;
  userId: string;
  needIds: string[];
  clusterName: string;
  category: string;
};

export type AutoClusterInput = {
  orgId: string | null;
  userId: string;
  timeWindowDays: number;
};

// ─── createManualCluster ─────────────────────────────────────────────────────

export const createManualCluster = async (input: ManualClusterInput) => {
  const { userId, needIds, clusterName, category } = input;
  let { orgId } = input;
  if (needIds.length < 1) throw new AppError(400, "At least one need is required");

  return db.transaction(async (trx) => {
    // 1. Load member needs with geo for centroid computation
    const membersQuery = trx("needs_analysis as n")
      .join("surveys as s", "n.survey_id", "s.id")
      .whereIn("n.id", needIds)
      .select("n.id", "n.urgency_score", "n.org_id", "s.latitude as lat", "s.longitude as lng");

    if (orgId) {
      membersQuery.andWhere("n.org_id", orgId);
    }

    const members = await membersQuery;

    if (members.length !== needIds.length) {
      throw new AppError(400, "Some needs were not found or are out of scope for your organization");
    }

    // If orgId is null (superadmin without an org), derive it from the first need.
    // aggregate_needs.org_id is NOT NULL, so we must always supply one.
    if (!orgId && members.length > 0) {
      orgId = members[0].org_id as string;
    }

    if (!orgId) {
      throw new AppError(400, "Could not determine organization for this cluster. Ensure the selected needs belong to an organization.");
    }

    // 2. Derive centroid + urgency
    const geo = computeCentroid(
      members.map((m: { lat: unknown; lng: unknown }) => ({
        lat: m.lat != null ? Number(m.lat) : null,
        lng: m.lng != null ? Number(m.lng) : null,
      })),
    );
    const urgencyScore = avg(members.map((m: { urgency_score: unknown }) => Number(m.urgency_score)));
    const urgencyLabel = urgencyToLabel(urgencyScore);

    // 3. Insert aggregate_needs with correct column names
    const [aggregate] = await trx("aggregate_needs")
      .insert({
        org_id: orgId,
        title: clusterName,           // NOT representative_summary
        need_category: category,      // NOT category column
        urgency_label: urgencyLabel,  // NOT NULL — was missing
        urgency_score: urgencyScore,  // NOT NULL — was missing
        centroid_lat: geo.lat,
        centroid_lng: geo.lng,
        radius_km: geo.radiusKm,
        member_count: members.length,
        cluster_score: 1.0,
        status: "pending_review",
      })
      .returning("*");

    // 4. Insert aggregate_need_members with correct column names
    await trx("aggregate_need_members").insert(
      needIds.map((needId) => ({
        aggregate_need_id: aggregate.id,
        needs_analysis_id: needId,
        cluster_score: 1.0,           // NOT confidence_score
        // added_at has a DB default
      })),
    );

    // 5. Update cluster_status + backref on member needs
    await trx("needs_analysis").whereIn("id", needIds).update({
      cluster_status: "clustered",
      aggregate_need_id: aggregate.id,
    });

    // 6. Roll up skills from member needs → aggregate_need_id
    await rollupNeedSkills(trx, aggregate.id, needIds);

    const requiredSkills = await clusterSkillKeys(trx, aggregate.id);
    return mapAggregateResponse(aggregate, requiredSkills);
  });
};

// ─── runAutoClustering ────────────────────────────────────────────────────────

export const runAutoClustering = async (input: AutoClusterInput) => {
  const { orgId, userId, timeWindowDays } = input;

  // 1. Load policy (fall back to defaults if absent)
  let policyRow: Record<string, unknown> | undefined;
  if (orgId) {
    policyRow = await db("cluster_policies").where({ org_id: orgId }).first();
  }
  const policy = policyRow ?? DEFAULT_POLICY;

  const policyObj = {
    categoryWeight: Number(policy.category_weight),
    locationWeight: Number(policy.location_weight),
    timeWeight: Number(policy.time_weight),
    semanticWeight: Number(policy.semantic_weight),
    threshold: Number(policy.threshold),
    timeWindowDays: Number(timeWindowDays || policy.time_window_days),
    radiusKmHardCap: Number(
      (policy as typeof DEFAULT_POLICY).radius_km_hard_cap ?? DEFAULT_POLICY.radius_km_hard_cap,
    ),
    maxClusterSize: Number(policy.max_cluster_size),
  };

  const cutoff = new Date(Date.now() - policyObj.timeWindowDays * 24 * 60 * 60 * 1000);

  // 2. Fetch unclustered needs without existing task assignments
  const needsQuery = db("needs_analysis as n")
    .join("surveys as s", "n.survey_id", "s.id")
    .leftJoin("task_assignments as ta", "n.id", "ta.need_id")
    .whereNull("ta.id")
    .where("n.status", "detected")
    .where("n.cluster_status", "unclustered")
    .where("n.created_at", ">=", cutoff)
    .select(
      "n.id",
      "n.category",
      "s.latitude as lat",
      "s.longitude as lng",
      "n.created_at as createdAt",
      "n.summary",
      "n.urgency_score",
    );

  if (orgId) {
    needsQuery.andWhere("n.org_id", orgId);
  }

  const needs = await needsQuery;

  if (needs.length < 2) {
    return {
      scannedNeeds: needs.length,
      createdClusters: 0,
      skippedSingletons: needs.length,
      clusters: [],
    };
  }

  // 3. Build score graph with hard gates
  const graph = new Graph();
  for (const need of needs) {
    graph.addVertex(need.id);
  }

  for (let i = 0; i < needs.length; i++) {
    for (let j = i + 1; j < needs.length; j++) {
      const a = needs[i];
      const b = needs[j];

      // Hard gate 1: same category
      if (a.category !== b.category) continue;

      // Hard gate 2: geo radius cap
      const aLat = a.lat != null ? Number(a.lat) : null;
      const aLng = a.lng != null ? Number(a.lng) : null;
      const bLat = b.lat != null ? Number(b.lat) : null;
      const bLng = b.lng != null ? Number(b.lng) : null;

      if (aLat !== null && aLng !== null && bLat !== null && bLng !== null) {
        const dist = haversineKm(aLat, aLng, bLat, bLng);
        if (dist > policyObj.radiusKmHardCap) continue;
      }

      // Hard gate 3: time window
      const msGap = Math.abs(
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      const daysGap = msGap / (1000 * 60 * 60 * 24);
      if (daysGap > policyObj.timeWindowDays) continue;

      // Weighted score
      const needA = {
        id: a.id,
        category: a.category,
        lat: aLat,
        lng: aLng,
        createdAt: new Date(a.createdAt),
        summary: a.summary ?? "",
      };
      const needB = {
        id: b.id,
        category: b.category,
        lat: bLat,
        lng: bLng,
        createdAt: new Date(b.createdAt),
        summary: b.summary ?? "",
      };

      const score = clusterScore(needA, needB, {
        categoryWeight: policyObj.categoryWeight,
        locationWeight: policyObj.locationWeight,
        timeWeight: policyObj.timeWeight,
        semanticWeight: policyObj.semanticWeight,
        threshold: policyObj.threshold,
        timeWindowDays: policyObj.timeWindowDays,
      });

      if (score >= policyObj.threshold) {
        graph.addEdge(a.id, b.id);
      }
    }
  }

  // 4. Extract connected components and create clusters
  const components = graph.getConnectedComponents();
  const created: ReturnType<typeof mapAggregateResponse>[] = [];
  let skippedSingletons = 0;

  for (const component of components) {
    if (component.length < 2) {
      skippedSingletons++;
      continue;
    }

    // Truncate to max_cluster_size
    const chunk = component.slice(0, policyObj.maxClusterSize);
    const chunkNeeds = needs.filter((n) => chunk.includes(n.id));

    // Calculate average pair score for the chunk
    let pairScoreSum = 0;
    let pairCount = 0;
    for (let i = 0; i < chunkNeeds.length; i++) {
      for (let j = i + 1; j < chunkNeeds.length; j++) {
        const a = chunkNeeds[i];
        const b = chunkNeeds[j];
        pairScoreSum += clusterScore(
          {
            id: a.id,
            category: a.category,
            lat: a.lat != null ? Number(a.lat) : null,
            lng: a.lng != null ? Number(a.lng) : null,
            createdAt: new Date(a.createdAt),
            summary: a.summary ?? "",
          },
          {
            id: b.id,
            category: b.category,
            lat: b.lat != null ? Number(b.lat) : null,
            lng: b.lng != null ? Number(b.lng) : null,
            createdAt: new Date(b.createdAt),
            summary: b.summary ?? "",
          },
          {
            categoryWeight: policyObj.categoryWeight,
            locationWeight: policyObj.locationWeight,
            timeWeight: policyObj.timeWeight,
            semanticWeight: policyObj.semanticWeight,
            threshold: policyObj.threshold,
            timeWindowDays: policyObj.timeWindowDays,
          },
        );
        pairCount++;
      }
    }
    const avgScore = pairCount > 0 ? pairScoreSum / pairCount : policyObj.threshold;

    // Build auto title
    const firstNeed = chunkNeeds[0];
    const centroidGeo = computeCentroid(
      chunkNeeds.map((n) => ({
        lat: n.lat != null ? Number(n.lat) : null,
        lng: n.lng != null ? Number(n.lng) : null,
      })),
    );
    const titleParts = [
      `Auto: ${firstNeed.category}`,
      centroidGeo.lat !== null
        ? `near ${centroidGeo.lat.toFixed(2)},${centroidGeo.lng!.toFixed(2)}`
        : null,
    ].filter(Boolean);
    const autoTitle = titleParts.join(" ");

    const result = await createManualCluster({
      orgId,
      userId,
      needIds: chunk,
      clusterName: autoTitle,
      category: firstNeed.category,
    });

    // Override cluster_score to the computed avg (manual cluster uses 1.0)
    await db("aggregate_needs")
      .where({ id: result.id })
      .update({ cluster_score: Number(avgScore.toFixed(3)) });

    created.push({ ...result, clusterScore: Number(avgScore.toFixed(3)) });
  }

  return {
    scannedNeeds: needs.length,
    createdClusters: created.length,
    skippedSingletons,
    clusters: created,
  };
};

// ─── fetchClusters ───────────────────────────────────────────────────────────

export const fetchClusters = async (orgId: string | null, status?: string) => {
  const query = db("aggregate_needs");
  if (orgId !== null) {
    query.where({ org_id: orgId });
  }
  if (status) query.andWhere({ status });
  return await query.orderBy("created_at", "desc");
};

// ─── fetchClusterById ─────────────────────────────────────────────────────────

export const fetchClusterById = async (id: string, orgId: string | null) => {
  const query = db("aggregate_needs").where({ id });
  if (orgId !== null) {
    query.andWhere({ org_id: orgId });
  }
  const aggregate = await query.first();
  if (!aggregate) return null;

  const members = await db("aggregate_need_members as anm")
    .join("needs_analysis as n", "anm.needs_analysis_id", "n.id")
    .join("surveys as s", "n.survey_id", "s.id")
    .where({ "anm.aggregate_need_id": id })
    .select(
      "n.id",
      "n.category",
      "n.summary",
      "n.priority_level",
      "n.urgency_score",
      "n.cluster_status",
      "s.location_text",
      "s.latitude",
      "s.longitude",
    );

  return { ...aggregate, members };
};

// ─── resumeClusterGraph ───────────────────────────────────────────────────────

export const resumeClusterGraph = async (
  aggregateNeedId: string,
  orgId: string | null,
  userId: string,
) => {
  const query = db("aggregate_needs").where({ id: aggregateNeedId });
  if (orgId !== null) {
    query.andWhere({ org_id: orgId });
  }
  const aggregate = await query.first();
  if (!aggregate) throw new AppError(404, "Cluster not found");

  let threadId = aggregate.langgraph_thread_id;
  if (!threadId) {
    threadId = `cluster_confirm_${aggregateNeedId}`;
  }

  const config = { configurable: { thread_id: threadId } };

  const state = await clusterGraph.getState(config);

  if (state && state.next && state.next.length > 0) {
    await clusterGraph.invoke(null, config);
  } else {
    await clusterGraph.invoke(
      {
        orgId: orgId ?? "",
        userId,
        confirmedClusterId: aggregateNeedId,
        needs: [],
        status: "pending_review",
      },
      config,
    );
  }

  return { status: "confirmed_and_dispatched" };
};

// ─── Legacy alias kept for backward compatibility with clusterGraph nodes ─────
export const runClusterAlgorithm = runAutoClustering;
