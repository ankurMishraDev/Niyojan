import { db } from "../../config/db";
import { Graph } from "./connectedComponents";
import { clusterScore } from "./clusterScore";
import { clusterGraph } from "./clusterGraph";

export const runClusterAlgorithm = async (orgId: string, userId: string, timeWindowDays: number) => {
  // 1. Fetch policy
  let policy = await db("cluster_policies").where({ org_id: orgId }).first();
  if (!policy) {
    policy = {
      category_weight: 0.4,
      location_weight: 0.3,
      time_weight: 0.15,
      semantic_weight: 0.15,
      threshold: 0.72,
      max_cluster_size: 15,
      time_window_days: timeWindowDays,
    };
  }

  // 2. Fetch unassigned needs
  const openNeeds = await db("needs_analysis as n")
    .join("surveys as s", "n.survey_id", "s.id")
    .where({ "n.org_id": orgId, "n.status": "detected", "n.cluster_status": "unclustered" })
    .leftJoin("task_assignments as ta", "n.id", "ta.need_id")
    .whereNull("ta.id") // Unassigned
    .select(
      "n.id",
      "n.category",
      "s.latitude as lat",
      "s.longitude as lng",
      "n.created_at as createdAt",
      "n.summary",
      "n.urgency_score",
      "n.priority_level"
    );

  if (openNeeds.length === 0) return { message: "No open needs to cluster" };

  // 3. Score pairs and build graph
  const graph = new Graph();
  for (const need of openNeeds) {
    graph.addVertex(need.id);
  }

  const policyObj = {
    categoryWeight: Number(policy.category_weight),
    locationWeight: Number(policy.location_weight),
    timeWeight: Number(policy.time_weight),
    semanticWeight: Number(policy.semantic_weight),
    threshold: Number(policy.threshold),
    timeWindowDays: Number(policy.time_window_days)
  };

  // N^2 comparison (MVP acceptable, in real world we'd use grid filtering)
  for (let i = 0; i < openNeeds.length; i++) {
    for (let j = i + 1; j < openNeeds.length; j++) {
      const score = clusterScore(openNeeds[i], openNeeds[j], policyObj);
      if (score >= policyObj.threshold) {
        graph.addEdge(openNeeds[i].id, openNeeds[j].id);
      }
    }
  }

  const components = graph.getConnectedComponents();
  const createdClusters = [];

  // 4. Start LangGraph for each candidate cluster (if size > 1)
  for (const component of components) {
    if (component.length > 1) { // Only cluster if there's more than 1 need
      // Enforce max_cluster_size could go here (split into chunks)
      const chunkedComponent = component.slice(0, policy.max_cluster_size);
      
      const componentNeeds = openNeeds.filter(n => chunkedComponent.includes(n.id));
      
      // Start LangGraph execution thread for this specific cluster candidate
      const threadId = `cluster_candidate_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const config = { configurable: { thread_id: threadId } };
      
      const result = await clusterGraph.invoke({
        orgId,
        userId,
        needs: componentNeeds,
        policy: policyObj
      }, config);
      
      // Update thread ID
      if (result.confirmedClusterId) {
        await db("aggregate_needs").where({ id: result.confirmedClusterId }).update({ langgraph_thread_id: threadId });
      }

      // The graph pauses BEFORE "ai_aggregation". 
      // result.confirmedClusterId is populated by nodeGenerateCandidate
      createdClusters.push({
        threadId,
        aggregateNeedId: result.confirmedClusterId
      });
    }
  }

  return { createdCount: createdClusters.length, clusters: createdClusters };
};

export const createManualCluster = async (orgId: string, userId: string, needIds: string[], clusterName: string, category: string) => {
  if (needIds.length < 1) {
    throw new Error("At least one need must be provided to create a cluster");
  }

  // Handle superadmin bypass
  const actualOrgId = orgId === 'superadmin-bypass' ? null : orgId;

  return await db.transaction(async (trx) => {
    // 1. Create the aggregate need
    const [aggregate] = await trx("aggregate_needs").insert({
      org_id: actualOrgId,
      status: "active",
      category: category,
      representative_summary: clusterName,
      created_by: userId,
      langgraph_thread_id: `manual_cluster_${Date.now()}`
    }).returning("*");

    // 2. Link the needs to this aggregate
    const membersToInsert = needIds.map(needId => ({
      aggregate_need_id: aggregate.id,
      needs_analysis_id: needId,
      confidence_score: 1.0, // Manual cluster has 100% confidence
      reasoning: "Manually clustered by admin"
    }));

    await trx("aggregate_need_members").insert(membersToInsert);

    // 3. Update the cluster_status of individual needs
    await trx("needs_analysis").whereIn("id", needIds).update({
      cluster_status: "clustered"
    });

    return aggregate;
  });
};

export const fetchClusters = async (orgId: string, status?: string) => {
  const query = db("aggregate_needs");
  if (orgId !== 'superadmin-bypass') {
    query.where({ org_id: orgId });
  }
  if (status) query.andWhere({ status });
  return await query.orderBy("created_at", "desc");
};

export const fetchClusterById = async (id: string, orgId: string) => {
  const aggregate = await db("aggregate_needs").where({ id, org_id: orgId }).first();
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
      "s.longitude"
    );

  return { ...aggregate, members };
};

export const resumeClusterGraph = async (aggregateNeedId: string, orgId: string, userId: string) => {
  const aggregate = await db("aggregate_needs").where({ id: aggregateNeedId }).first();
  if (!aggregate) throw new Error("Cluster not found");
  
  let threadId = aggregate.langgraph_thread_id;
  if (!threadId) {
    // Fallback if missing
    threadId = `cluster_confirm_${aggregateNeedId}`;
  }
  
  const config = { configurable: { thread_id: threadId } };
  
  // Try to resume graph
  const state = await clusterGraph.getState(config);
  
  if (state && state.next && state.next.length > 0) {
    // Graph is paused, we can resume it
    await clusterGraph.invoke(null, config); // Pass null to resume with existing state
  } else {
    // If state is missing (e.g. MemorySaver reset on restart), we run it manually by re-invoking
    await clusterGraph.invoke({
      orgId,
      userId,
      confirmedClusterId: aggregateNeedId,
      needs: [], // Assuming needs are not directly required by ai_aggregation, it fetches from DB
      status: "pending_review"
    }, config);
  }

  return { status: "confirmed_and_dispatched" };
};
