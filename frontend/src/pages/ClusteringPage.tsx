import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button, Input, LoaderBlock, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { clusteringApi, needsApi } from "@/lib/services";
import { getApiErrorMessage } from "@/lib/api";
import { toneForStatus } from "@/lib/format";

export function ClusteringPage() {
  const queryClient = useQueryClient();
  const [selectedNeedIds, setSelectedNeedIds] = useState<Set<string>>(new Set());
  const [clusterName, setClusterName] = useState("");
  const [clusterCategory, setClusterCategory] = useState("general");
  const [feedback, setFeedback] = useState("");

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

  const needs = (needsQuery.data?.items ?? []).filter((n: any) => n.clusterStatus === "unclustered");

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <PageHeader
        eyebrow="Smart Operations"
        title="Need Clustering"
        description="View AI-generated clusters or manually group open survey needs into operational clusters for dispatch."
      />

      {feedback ? (
        <div className="rounded-md border border-hairline-strong bg-canvas px-4 py-3 text-sm text-ink shadow-sm">
          {feedback}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="space-y-4">
          <div>
            <p className="text-xl font-semibold tracking-tight text-ink">Unclustered Open Needs</p>
            <p className="mt-1 text-sm text-body">
              Select multiple needs to group them into a single manual cluster.
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
                  onClick={() => toggleNeed(need.id)}
                  className={`cursor-pointer rounded border p-3 transition-colors ${
                    selectedNeedIds.has(need.id) 
                      ? "border-primary bg-primary/5" 
                      : "border-hairline hover:border-hairline-strong bg-canvas"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={selectedNeedIds.has(need.id)} 
                        readOnly 
                        className="rounded border-hairline text-primary focus:ring-primary"
                      />
                      <div>
                        <p className="font-medium text-ink text-sm line-clamp-2">{need.summary}</p>
                        <p className="text-xs text-mute mt-1">{need.category}</p>
                      </div>
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
              {manualClusterMutation.isPending ? "Creating..." : `Create Cluster with ${selectedNeedIds.size} Needs`}
            </Button>
          </div>
        </Panel>

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
                      {/* Support both old (representative_summary/category) and new (title/need_category) column names */}
                      <p className="font-medium text-ink">{cluster.title ?? cluster.representative_summary ?? "Unnamed Cluster"}</p>
                      <p className="text-xs text-mute mt-1">Category: {cluster.need_category ?? cluster.category ?? "—"}</p>
                      {cluster.memberCount != null && (
                        <p className="text-xs text-mute mt-0.5">{cluster.memberCount} need{cluster.memberCount !== 1 ? "s" : ""}</p>
                      )}
                    </div>
                    <StatusBadge tone={toneForStatus(cluster.status)}>{cluster.status}</StatusBadge>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {/* The admin can match a cluster similarly to matching a need. Assuming assignments support aggregate_need_id */}
                    <Link to={`/matching?clusterId=${cluster.id}`} className="inline-flex items-center justify-center rounded-md border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition-colors hover:bg-canvas-soft">
                      Assign Volunteer
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
