import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button, LoaderBlock, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { assignmentsApi, matchingApi, needsApi } from "@/lib/services";
import { formatPercent, toneForStatus } from "@/lib/format";

export function MatchingPage() {
  const navigate = useNavigate();
  const [selectedNeedId, setSelectedNeedId] = useState("");

  const needsQuery = useQuery({
    queryKey: ["matching-needs"],
    queryFn: () => needsApi.list({ page: 1, pageSize: 25, status: "open" }),
  });

  useEffect(() => {
    if (!selectedNeedId && needsQuery.data?.items[0]) {
      setSelectedNeedId(needsQuery.data.items[0].id);
    }
  }, [needsQuery.data, selectedNeedId]);

  const matchesQuery = useQuery({
    enabled: Boolean(selectedNeedId),
    queryKey: ["matches", selectedNeedId],
    queryFn: () => matchingApi.getMatches(selectedNeedId),
  });

  const assignMutation = useMutation({
    mutationFn: (payload: { volunteerId: string; matchScore: number; matchReason: Record<string, unknown> }) =>
      assignmentsApi.create({
        need_id: selectedNeedId,
        volunteer_id: payload.volunteerId,
        status: "suggested",
        match_score: payload.matchScore,
        match_reason_json: payload.matchReason,
      }),
    onSuccess: (assignment) => {
      navigate("/assignments", { state: { assignmentId: assignment.id } });
    },
  });

  if (needsQuery.isLoading) {
    return <LoaderBlock label="Loading matching workspace..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Critical Deployment"
        title="Volunteer Matching"
        description="Match open needs to volunteer availability, proximity, and skill overlap using the backend's deterministic scoring model."
      />

      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel className="space-y-4">
          <p className="text-xl font-black text-white">Open needs</p>
          <div className="space-y-3">
            {needsQuery.data?.items.map((need) => (
              <button
                className={`w-full rounded-md border px-4 py-4 text-left ${
                  selectedNeedId === need.id
                    ? "border-primary bg-primary/10"
                    : "border-outline-variant bg-surface-container-low hover:border-primary/50"
                }`}
                key={need.id}
                onClick={() => setSelectedNeedId(need.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{need.summary}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{need.locationText ?? "Unknown location"}</p>
                  </div>
                  <StatusBadge tone={toneForStatus(need.priorityLevel)}>
                    {need.priorityLevel}
                  </StatusBadge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {need.skills.map((skill) => (
                    <span
                      className="rounded-md border border-outline-variant px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-on-surface-variant"
                      key={skill.skillId}
                    >
                      {skill.key}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <div className="space-y-6">
          {!matchesQuery.data ? (
            <LoaderBlock label="Select a need to calculate matches..." />
          ) : (
            <>
              <Panel className="grid gap-4 md:grid-cols-4">
                <StatItem label="Required skills" value={matchesQuery.data.need.requiredSkills.length} />
                <StatItem label="Urgency score" value={matchesQuery.data.need.urgencyScore} />
                <StatItem label="Priority" value={matchesQuery.data.need.priorityLevel} />
                <StatItem label="Candidate pool" value={matchesQuery.data.matches.length} />
              </Panel>

              <div className="grid gap-4 xl:grid-cols-2">
                {matchesQuery.data.matches.map((match) => (
                  <Panel className="space-y-4" key={match.volunteerId}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xl font-black text-white">{match.name}</p>
                        <p className="mt-1 text-sm text-on-surface-variant">{match.email}</p>
                      </div>
                      <StatusBadge tone="success">{formatPercent(match.matchScore, 0)} match</StatusBadge>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <StatItem label="Availability" value={match.availabilityStatus} />
                      <StatItem label="Distance" value={match.distanceKm ?? "Unknown"} />
                      <StatItem label="Skill overlap" value={formatPercent(match.breakdown.skillScore, 0)} />
                      <StatItem label="Location score" value={formatPercent(match.breakdown.locationScore, 0)} />
                    </div>

                    <div>
                      <p className="label-caps">Matched skills</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {match.matchedSkills.map((skill) => (
                          <span
                            className="rounded-md border border-primary/50 bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-primary"
                            key={skill}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    {match.missingSkills.length > 0 ? (
                      <div>
                        <p className="label-caps">Missing skills</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {match.missingSkills.map((skill) => (
                            <span
                              className="rounded-md border border-warning/50 bg-warning/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-warning"
                              key={skill}
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <p className="text-sm leading-7 text-on-surface-variant">
                      {match.matchReason.explanation}
                    </p>

                    <Button
                      disabled={assignMutation.isPending}
                      onClick={() =>
                        void assignMutation.mutate({
                          volunteerId: match.volunteerId,
                          matchScore: match.matchScore,
                          matchReason: match.matchReason,
                        })
                      }
                    >
                      {assignMutation.isPending ? "Assigning..." : "Create assignment"}
                    </Button>
                  </Panel>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-outline-variant bg-surface-container-low p-4">
      <p className="label-caps">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}
