import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Button, Input, LoaderBlock, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { clusteringApi, needsApi } from "@/lib/services";
import { getApiErrorMessage } from "@/lib/api";
import { toneForStatus } from "@/lib/format";

export function ClusteringPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedNeedIds, setSelectedNeedIds] = useState<Set<string>>(new Set());
  const [clusterName, setClusterName] = useState("");
  const [clusterCategory, setClusterCategory] = useState("general");
  const [feedback, setFeedback] = useState("");
  // Which cluster's surveys are expanded in the UI
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
  // Cache of member surveys per cluster id (fetched lazily on expand)
  const [clusterMembers, setClusterMembers] = useState<Record<string, any[]>>({});
  const [loadingCluster, setLoadingCluster] = useState<string | null>(null);

  const needsQuery = useQuery({
    queryKey: ["unclustered-needs"],
    queryFn: () => needsApi.list({ page: 1, pageSize: 100, status: "open" }),
  });

  const clustersQuery = useQuery({
    queryKey: ["clusters"],
    queryFn: () => clusteringApi.list(),
  });

  const manualClusterMutation = useMutation({
    mutationFn: () => clusteringApi.manual({ 
      needIds: Array.from(selectedNeedIds), 
      clusterName, 
      category: clusterCategory 
    }),
    onSuccess: async () => {
      setFeedback("Manual cluster created successfully.");
      setSelectedNeedIds(new Set());
      setClusterName("");
      await queryClient.invalidateQueries({ queryKey: ["unclustered-needs"] });
      await queryClient.invalidateQueries({ queryKey: ["clusters"] });
    },
    onError: (err) => {
      setFeedback(`Clustering failed: ${getApiErrorMessage(err)}`);
    }
  });

  const toggleNeed = (id: string) => {
    const newSet = new Set(selectedNeedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedNeedIds(newSet);
  };

  // Fetch cluster members on demand when "View Included Surveys" is clicked
  const handleViewSurveys = async (clusterId: string) => {
    if (expandedClusterId === clusterId) {
      setExpandedClusterId(null);
      return;
    }
    setExpandedClusterId(clusterId);
    if (clusterMembers[clusterId]) return; // already loaded

    setLoadingCluster(clusterId);
    try {
      const detail = await clusteringApi.get(clusterId);
      setClusterMembers((prev) => ({ ...prev, [clusterId]: detail.members ?? [] }));
    } catch {
      setFeedback(`Failed to load cluster members.`);
    } finally {
      setLoadingCluster(null);
    }
  };

  const needs = (needsQuery.data?.items ?? []).filter((n: any) => n.clusterStatus === "unclustered");

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <PageHeader
        eyebrow="Smart Operations"
        title="Clustering Needs"
        description="View AI-generated clusters or manually group open survey needs into operational clusters for dispatch."
      />

      {feedback ? (
        <div className="rounded-md border border-hairline-strong bg-canvas px-4 py-3 text-sm text-ink shadow-sm">
          {feedback}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Left: unclustered needs ── */}
        <Panel className="space-y-4">
          <div>
            <p className="text-xl font-semibold tracking-tight text-ink">Unclustered Open Needs</p>
            <p className="mt-1 text-sm text-body">
              Click a need to open its AI review. Check the box to add it to a manual cluster.
            </p>
          </div>

          {needsQuery.isLoading ? (
            <LoaderBlock label="Loading needs..." />
          ) : needs.length === 0 ? (
            <div className="p-4 text-sm text-mute text-center border border-dashed border-hairline rounded">
              No unclustered open needs available.
            </div>
          ) : (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
              {needs.map((need: any) => (
                <div
                  key={need.id}
                  className={`rounded border p-3 transition-colors ${
                    selectedNeedIds.has(need.id)
                      ? "border-primary bg-primary/5"
                      : "border-hairline hover:border-hairline-strong bg-canvas"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* Checkbox — stops propagation so click on the row can navigate */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <input
                        title={`Select need: ${need.summary}`}
                        type="checkbox"
                        checked={selectedNeedIds.has(need.id)}
                        onChange={() => toggleNeed(need.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 rounded border-hairline text-primary focus:ring-primary flex-shrink-0"
                      />
                      {/* Clicking the text opens AI review for this survey */}
                      <button
                        type="button"
                        onClick={() => {
                          if (need.surveyId) {
                            // Use survey review route, not document review route
                            navigate(`/ai-review/surveys/${need.surveyId}`);
                          }
                        }}
                        className="text-left min-w-0"
                        title="Open AI Review for this survey"
                      >
                        <p className="font-medium text-ink text-sm line-clamp-2 hover:text-link transition-colors">
                          {need.summary}
                        </p>
                        <p className="text-xs text-mute mt-1">{need.category}</p>
                        {need.surveyId && (
                          <p className="text-[10px] font-mono text-mute/70 mt-0.5">
                            Survey: {need.surveyId.slice(0, 12)}… · Click to open AI Review ↗
                          </p>
                        )}
                      </button>
                    </div>
                    <StatusBadge tone={toneForStatus(need.priorityLevel)}>{need.priorityLevel}</StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-hairline space-y-3">
            <Input
              placeholder="Cluster Name (e.g. South District Food Relief)"
              value={clusterName}
              onChange={(e) => setClusterName(e.target.value)}
              disabled={selectedNeedIds.size < 1}
            />
            <Input
              placeholder="Category (e.g. food_supply)"
              value={clusterCategory}
              onChange={(e) => setClusterCategory(e.target.value)}
              disabled={selectedNeedIds.size < 1}
            />
            <Button
              className="w-full"
              disabled={selectedNeedIds.size < 1 || !clusterName || manualClusterMutation.isPending}
              onClick={() => manualClusterMutation.mutate()}
            >
              {manualClusterMutation.isPending ? "Creating..." : `Create Cluster with ${selectedNeedIds.size} Need${selectedNeedIds.size !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </Panel>

        {/* ── Right: active clusters ── */}
        <Panel className="space-y-4">
          <div>
            <p className="text-xl font-semibold tracking-tight text-ink">Active Clusters</p>
            <p className="mt-1 text-sm text-body">
              Recent clusters grouped by AI or manually.
            </p>
          </div>

          {clustersQuery.isLoading ? (
            <LoaderBlock label="Loading clusters..." />
          ) : !clustersQuery.data?.length ? (
            <div className="p-4 text-sm text-mute text-center border border-dashed border-hairline rounded">
              No active clusters found.
            </div>
          ) : (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              {clustersQuery.data.map((cluster: any) => (
                <div key={cluster.id} className="rounded border border-hairline bg-canvas-soft p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-ink">
                        {cluster.title ?? cluster.representative_summary ?? "Unnamed Cluster"}
                      </p>
                      <p className="text-xs text-mute mt-1">
                        Category: {cluster.need_category ?? cluster.category ?? "—"}
                      </p>
                      {cluster.memberCount != null && (
                        <p className="text-xs text-mute mt-0.5">
                          {cluster.memberCount} need{cluster.memberCount !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                    <StatusBadge tone={toneForStatus(cluster.status)}>{cluster.status}</StatusBadge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 items-center">
                    {/* Assign Volunteer */}
                    <Link
                      to={`/matching?clusterId=${cluster.id}`}
                      className="inline-flex items-center justify-center rounded-md border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition-colors hover:bg-canvas-soft"
                    >
                      Assign Volunteer
                    </Link>

                    {/* View Included Surveys */}
                    <button
                      onClick={() => void handleViewSurveys(cluster.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-canvas-soft px-3 py-1.5 text-xs font-medium text-body shadow-sm transition-colors hover:bg-canvas-soft-2 hover:text-ink"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      {expandedClusterId === cluster.id ? "Hide Surveys" : "View Included Surveys"}
                    </button>

                    {/* Copy cluster ID */}
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(cluster.id);
                        setFeedback(`Cluster ID copied: ${cluster.id.slice(0, 8)}…`);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-canvas-soft px-3 py-1.5 text-xs font-medium text-body shadow-sm transition-colors hover:bg-canvas-soft-2 hover:text-ink"
                      title={`Copy cluster ID: ${cluster.id}`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy ID
                    </button>
                  </div>

                  {/* ── Expanded: included surveys ── */}
                  {expandedClusterId === cluster.id && (
                    <div className="mt-4 pt-4 border-t border-hairline space-y-2">
                      <p className="text-xs font-mono uppercase tracking-wider text-mute mb-2">
                        Included Surveys
                      </p>
                      {loadingCluster === cluster.id ? (
                        <p className="text-xs text-mute">Loading…</p>
                      ) : (clusterMembers[cluster.id] ?? []).length === 0 ? (
                        <p className="text-xs text-mute italic">No member details available.</p>
                      ) : (
                        (clusterMembers[cluster.id] ?? []).map((member: any) => {
                          const surveyId = member.survey_id ?? member.surveyId;
                          return (
                            <div
                              key={member.id}
                              className="rounded border border-hairline bg-canvas px-3 py-2 flex items-start justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-ink line-clamp-2">
                                  {member.summary ?? "Need"}
                                </p>
                                <p className="text-[10px] text-mute mt-0.5">
                                  {member.category ?? "—"} · priority: {member.priority_level ?? "—"}
                                </p>
                                {surveyId && (
                                  <p className="text-[10px] font-mono text-mute/70 mt-0.5">
                                    Survey: {surveyId.slice(0, 12)}…
                                  </p>
                                )}
                              </div>
                              {surveyId ? (
                                <Link
                                  to={`/ai-review/surveys/${surveyId}`}
                                  className="shrink-0 inline-flex items-center gap-1 rounded border border-hairline bg-canvas-soft px-2 py-1 text-[10px] font-medium text-ink hover:bg-canvas-soft-2 transition-colors"
                                >
                                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  AI Review
                                </Link>
                              ) : (
                                <span className="text-[10px] text-mute italic">No survey</span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  <p className="mt-2 font-mono text-[10px] text-mute">
                    ID: {cluster.id.slice(0, 16)}…
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
