import { StateGraph, END, START } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { ClusterStateAnnotation, ClusterState } from "./clusterGraphState";
import { db } from "../../config/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

// Memory saver for the checkpointer (In production, replace with PostgresCheckpointer)
export const clusterCheckpointer = new MemorySaver();

const nodeGenerateCandidate = async (state: ClusterState): Promise<Partial<ClusterState>> => {
  const trx = await db.transaction();
  try {
    // 1. Calculate centroid
    let sumLat = 0, sumLng = 0;
    let validLocCount = 0;
    
    for (const need of state.needs) {
      if (need.lat !== null && need.lng !== null) {
        sumLat += need.lat;
        sumLng += need.lng;
        validLocCount++;
      }
    }
    
    const centroidLat = validLocCount > 0 ? sumLat / validLocCount : null;
    const centroidLng = validLocCount > 0 ? sumLng / validLocCount : null;

    // 2. Determine base urgency (max)
    let maxUrgencyScore = 0;
    let urgencyLabel = "low";
    
    const priorityRank = (val: string) => {
      if (val === "critical") return 4;
      if (val === "high") return 3;
      if (val === "medium") return 2;
      return 1;
    };

    for (const need of state.needs) {
      if (need.urgency_score > maxUrgencyScore) maxUrgencyScore = need.urgency_score;
      if (priorityRank(need.priority_level) > priorityRank(urgencyLabel)) {
        urgencyLabel = need.priority_level;
      }
    }

    // 3. Save Candidate Cluster to DB
    const [aggregate] = await trx("aggregate_needs").insert({
      org_id: state.orgId,
      title: "Pending Cluster",
      description: "Pending Gemini summary",
      need_category: state.needs[0]?.category || "general", // assumes homogeneous category
      urgency_label: urgencyLabel,
      urgency_score: maxUrgencyScore,
      centroid_lat: centroidLat,
      centroid_lng: centroidLng,
      member_count: state.needs.length,
      status: "pending_review",
      langgraph_thread_id: state.status, // We'll pass threadId via status temporarily or state
    }).returning("*");

    // 4. Attach members
    for (const need of state.needs) {
      await trx("aggregate_need_members").insert({
        aggregate_need_id: aggregate.id,
        needs_analysis_id: need.id,
        cluster_score: 1.0, // Mock score for now, should come from state if we pass it
      });

      await trx("needs_analysis")
        .where({ id: need.id })
        .update({ cluster_status: "candidate", aggregate_need_id: aggregate.id });
    }

    await trx.commit();
    return { confirmedClusterId: aggregate.id, status: "pending_review" };
  } catch (error) {
    await trx.rollback();
    throw error;
  }
};

const nodeAiAggregation = async (state: ClusterState): Promise<Partial<ClusterState>> => {
  if (!state.confirmedClusterId) return {};

  const members = await db("aggregate_need_members")
    .join("needs_analysis", "aggregate_need_members.needs_analysis_id", "needs_analysis.id")
    .where({ aggregate_need_id: state.confirmedClusterId })
    .select("needs_analysis.summary", "needs_analysis.priority_level");

  if (members.length === 0) return {};

  const prompt = `
  Summarize these ${members.length} related community needs into a single 3-sentence aggregate case summary.
  Identify the single most critical urgency factor.
  Suggest a combined title under 10 words.
  
  Needs:
  ${members.map((m, i) => `${i + 1}. ${m.summary} (Priority: ${m.priority_level})`).join("\n")}
  
  Return ONLY valid JSON with keys: title, description, combined_urgency.
  `;

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" }});
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  try {
    const json = JSON.parse(text);
    return {
      aggregateSummary: {
        title: json.title,
        description: json.description,
        urgencyLabel: json.combined_urgency,
        urgencyScore: state.needs[0]?.urgency_score || 0, // Fallback, could be recalculated
      },
      status: "summarized"
    };
  } catch (e) {
    console.error("Gemini failed to parse JSON", e);
    return { status: "summarized_failed" };
  }
};

const nodeDispatch = async (state: ClusterState): Promise<Partial<ClusterState>> => {
  if (!state.confirmedClusterId || !state.aggregateSummary) return {};

  const trx = await db.transaction();
  try {
    // 1. Update aggregate need with Gemini summary
    await trx("aggregate_needs")
      .where({ id: state.confirmedClusterId })
      .update({
        title: state.aggregateSummary.title,
        description: state.aggregateSummary.description,
        status: "confirmed",
        reviewed_by: state.userId,
        reviewed_at: new Date(),
        updated_at: new Date()
      });

    // 2. Mark members as merged
    await trx("needs_analysis")
      .where({ aggregate_need_id: state.confirmedClusterId })
      .update({ cluster_status: "merged" });

    // 3. Propagate need_skills
    const memberSkills = await trx("need_skills")
      .join("aggregate_need_members", "need_skills.need_id", "aggregate_need_members.needs_analysis_id")
      .where({ "aggregate_need_members.aggregate_need_id": state.confirmedClusterId })
      .select("need_skills.skill_id")
      .distinct();

    for (const skill of memberSkills) {
      await trx("need_skills").insert({
        aggregate_need_id: state.confirmedClusterId,
        skill_id: skill.skill_id
      });
    }

    await trx.commit();
    return { status: "completed" };
  } catch (error) {
    await trx.rollback();
    throw error;
  }
};

// Define the LangGraph
export const clusterWorkflow = new StateGraph(ClusterStateAnnotation)
  .addNode("candidate_generation", nodeGenerateCandidate)
  .addNode("ai_aggregation", nodeAiAggregation)
  .addNode("dispatch", nodeDispatch)

  .addEdge(START, "candidate_generation")
  
  // The magic BreakPoint: execution pauses after candidate_generation
  // The system waits for human review. Once human confirms, we resume.
  .addEdge("candidate_generation", "ai_aggregation")
  .addEdge("ai_aggregation", "dispatch")
  .addEdge("dispatch", END);

export const clusterGraph = clusterWorkflow.compile({
  checkpointer: clusterCheckpointer,
  interruptBefore: ["ai_aggregation"] // Interrupt BEFORE AI aggregation (the human review step)
});
