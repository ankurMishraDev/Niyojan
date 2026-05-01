import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, InlineError, Input, LoaderBlock, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { assignmentsApi, authApi, matchingApi, needsApi, pipelineApi, surveysApi } from "@/lib/services";
import { formatDateTime, formatPercent, sentence, toneForStatus } from "@/lib/format";
import type { MatchResult, Need } from "@/types/api";

const formatDistance = (distanceKm: number | null) => {
  if (distanceKm === null) {
    return "Unknown distance";
  }

  return `${distanceKm} km`;
};

const priorityCopy: Record<string, string> = {
  critical: "Immediate action recommended",
  high: "Should be assigned soon",
  medium: "Schedule with available capacity",
  low: "Can be queued behind urgent cases",
};

export function MatchingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchSurveyId, setSearchSurveyId] = useState(searchParams.get("surveyId") ?? "");
  const [selectedNeedId, setSelectedNeedId] = useState("");
  const surveyId = searchParams.get("surveyId") ?? "";

  useEffect(() => {
    setSearchSurveyId(surveyId);
  }, [surveyId]);

  const optionsQuery = useQuery({
    queryKey: ["matching-domains"],
    queryFn: () => authApi.volunteerOnboardingOptions(),
  });

  const surveyQuery = useQuery({
    enabled: Boolean(surveyId),
    queryKey: ["matching-survey", surveyId],
    queryFn: () => surveysApi.get(surveyId),
  });

  const reviewQuery = useQuery({
    enabled: Boolean(surveyId),
    queryKey: ["matching-survey-review", surveyId],
    queryFn: () => pipelineApi.surveyReviewPackage(surveyId),
  });

  const needsQuery = useQuery({
    enabled: Boolean(surveyId),
    queryKey: ["matching-needs", surveyId],
    queryFn: () => needsApi.list({ page: 1, pageSize: 25, status: "open", survey_id: surveyId }),
  });

  const needs = needsQuery.data?.items ?? [];

  useEffect(() => {
    if (needs.length === 0) {
      setSelectedNeedId("");
      return;
    }

    if (!needs.some((need) => need.id === selectedNeedId)) {
      setSelectedNeedId(needs[0].id);
    }
  }, [needs, selectedNeedId]);

  const selectedNeed = needs.find((need) => need.id === selectedNeedId) ?? null;

  const matchesQuery = useQuery({
    enabled: Boolean(selectedNeedId),
    queryKey: ["matching-results", selectedNeedId],
    queryFn: () => matchingApi.getMatches(selectedNeedId),
  });

  const rankedVolunteers = matchesQuery.data?.matches ?? [];
  const selectedNeedMatches = matchesQuery.data;

  const assignMutation = useMutation({
    mutationFn: (payload: {
      volunteerId: string;
      distanceKm: number | null;
      matchScore: number;
      matchedSkills: string[];
      missingSkills: string[];
      volunteerName: string;
      explanation: string;
      breakdown: {
        skillScore: number;
        availabilityScore: number;
        locationScore: number;
      };
    }) =>
      assignmentsApi.create({
        survey_id: surveyId,
        need_id: selectedNeed?.id || undefined,
        volunteer_id: payload.volunteerId,
        status: "suggested",
        match_score: payload.matchScore,
        match_reason_json: {
          assignment_mode: "ranked_match",
          survey_id: surveyId,
          selected_need_id: selectedNeed?.id || null,
          selected_need_summary: selectedNeed?.summary || null,
          case_summary: reviewQuery.data?.reasoningOutput?.case_summary || null,
          volunteer_name: payload.volunteerName,
          distance_km: payload.distanceKm,
          score_breakdown: payload.breakdown,
          matched_skills: payload.matchedSkills,
          missing_skills: payload.missingSkills,
          explanation: payload.explanation,
        },
      }),
    onSuccess: (assignment) => {
      navigate("/assignments", { state: { assignmentId: assignment.id } });
    },
  });

  if (optionsQuery.isLoading) {
    return <LoaderBlock label="Loading matching workspace..." />;
  }

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const nextId = searchSurveyId.trim();
    if (!nextId) {
      setSearchParams({});
      return;
    }

    setSearchParams({ surveyId: nextId });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations Matching"
        title="Case Assignment"
        description="Load a submitted case, select the operational need, and review ranked volunteers using backend scoring for skill fit, availability, and distance."
      />

      <Panel className="space-y-4">
        <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={onSearch}>
          <Input
            placeholder="Paste submitted survey ID"
            value={searchSurveyId}
            onChange={(event) => setSearchSurveyId(event.target.value)}
          />
          <Button type="submit">Open case</Button>
        </form>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            {surveyId ? `Loaded case: ${surveyId}` : "Enter a survey ID to load the case and ranked volunteers."}
          </div>
          <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3">
            <p className="label-caps">Coverage</p>
            <p className="mt-2 text-sm font-semibold text-white">{optionsQuery.data?.domains.length ?? 0} domains configured</p>
          </div>
        </div>
      </Panel>

      {!surveyId ? null : surveyQuery.isLoading || needsQuery.isLoading || reviewQuery.isLoading ? (
        <LoaderBlock label="Loading case details and assignment context..." />
      ) : surveyQuery.data ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <Panel className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-black text-white">Case intake</p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {surveyQuery.data.respondentName || "Unnamed respondent"}
                  </p>
                </div>
                <StatusBadge tone={toneForStatus(surveyQuery.data.status)}>{surveyQuery.data.status}</StatusBadge>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard label="Location" value={surveyQuery.data.locationText || "No location"} />
                <InfoCard label="Submitted" value={formatDateTime(surveyQuery.data.submittedAt)} />
                <InfoCard label="Open needs" value={String(needs.length)} />
                <InfoCard
                  label="Priority focus"
                  value={selectedNeed ? sentence(selectedNeed.priorityLevel) : "Select a need"}
                />
              </div>
              <Panel className="bg-surface-container-low">
                <p className="label-caps">Case summary</p>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                  {String(reviewQuery.data?.reasoningOutput?.case_summary || "Case review summary is not available yet.")}
                </p>
              </Panel>
            </Panel>

            <Panel className="space-y-4">
              <div>
                <p className="text-xl font-black text-white">Assignment needs</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Select the need that best reflects the case. Assignment rankings update from the backend for the need you choose.
                </p>
              </div>
              {needs.length === 0 ? (
                <p className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                  No case needs were generated for this survey yet. Review or reprocess the case before assigning a volunteer.
                </p>
              ) : (
                <div className="space-y-3">
                  {needs.map((need) => (
                    <button
                      className={`w-full rounded-xl border px-4 py-4 text-left transition ${
                        selectedNeedId === need.id
                          ? "border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(120,220,119,0.2)]"
                          : "border-outline-variant bg-surface-container-low hover:border-primary/50"
                      }`}
                      key={need.id}
                      onClick={() => setSelectedNeedId(need.id)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{need.summary}</p>
                          <p className="mt-1 text-xs text-on-surface-variant">{sentence(need.category)}</p>
                        </div>
                        <StatusBadge tone={toneForStatus(need.priorityLevel)}>{need.priorityLevel}</StatusBadge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <MiniStat label="Urgency" value={`${need.urgencyScore}`} />
                        <MiniStat label="Skills" value={String(need.skills.length)} />
                        <MiniStat label="Status" value={sentence(need.status)} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <Panel className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xl font-black text-white">Ranked volunteers</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Results come from backend ranking. Use the score, distance, availability, and skill coverage to make the assignment call.
                </p>
              </div>
              <StatusBadge tone="success">{rankedVolunteers.length} found</StatusBadge>
            </div>

            {selectedNeed ? <SelectedNeedSummary need={selectedNeed} result={selectedNeedMatches} /> : null}

            {!selectedNeed ? (
              <p className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                Select a need to load ranked volunteers.
              </p>
            ) : matchesQuery.isLoading ? (
              <LoaderBlock label="Loading ranked volunteers..." />
            ) : matchesQuery.isError ? (
              <InlineError
                message="Could not load ranked volunteers for the selected need."
                onRetry={() => void matchesQuery.refetch()}
              />
            ) : rankedVolunteers.length === 0 ? (
              <p className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                No ranked volunteers are available for this need.
              </p>
            ) : (
              <div className="space-y-4">
                {rankedVolunteers.map((volunteer, index) => (
                  <Panel className="space-y-4 bg-surface-container-low" key={volunteer.volunteerId}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="label-caps text-primary">Rank #{index + 1}</p>
                        <p className="text-xl font-black text-white">{volunteer.name || volunteer.volunteerId}</p>
                        <p className="mt-1 text-sm text-on-surface-variant">{volunteer.email || "No email provided"}</p>
                      </div>
                      <div className="space-y-2 text-right">
                        <StatusBadge tone="success">{formatPercent(volunteer.matchScore, 0)} match</StatusBadge>
                        <p className="text-xs text-on-surface-variant">{formatDistance(volunteer.distanceKm)}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      <InfoCard label="Availability" value={sentence(volunteer.availabilityStatus)} />
                      <InfoCard label="Skill fit" value={formatPercent(volunteer.breakdown.skillScore, 0)} />
                      <InfoCard label="Location fit" value={formatPercent(volunteer.breakdown.locationScore, 0)} />
                      <InfoCard label="Readiness" value={readinessLabel(volunteer.matchScore)} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="label-caps">Covered skills</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {volunteer.matchedSkills.length > 0 ? volunteer.matchedSkills.map((skill) => (
                            <span
                              className="rounded-md border border-primary/50 bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-primary"
                              key={`${volunteer.volunteerId}-${skill}`}
                            >
                              {skill}
                            </span>
                          )) : <span className="text-xs text-on-surface-variant">No required skills covered</span>}
                        </div>
                      </div>

                      <div>
                        <p className="label-caps">Gaps to note</p>
                        {volunteer.missingSkills.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {volunteer.missingSkills.map((skill) => (
                              <span
                                className="rounded-md border border-warning/50 bg-warning/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-warning"
                                key={`${volunteer.volunteerId}-missing-${skill}`}
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-on-surface-variant">All listed skills are covered for this need.</p>
                        )}
                      </div>
                    </div>

                    <Panel className="bg-black/10">
                      <p className="label-caps">Assignment note</p>
                      <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                        {volunteer.matchReason.explanation}
                      </p>
                    </Panel>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Button
                        disabled={assignMutation.isPending}
                        onClick={() =>
                          void assignMutation.mutate({
                            volunteerId: volunteer.volunteerId,
                            distanceKm: volunteer.distanceKm,
                            matchScore: volunteer.matchScore,
                            matchedSkills: volunteer.matchedSkills,
                            missingSkills: volunteer.missingSkills,
                            volunteerName: volunteer.name || volunteer.volunteerId,
                            explanation: volunteer.matchReason.explanation,
                            breakdown: volunteer.breakdown,
                          })
                        }
                      >
                        {assignMutation.isPending ? "Assigning..." : "Assign volunteer"}
                      </Button>
                    </div>
                  </Panel>
                ))}
              </div>
            )}
          </Panel>
        </div>
      ) : (
        <InlineError message="Survey not found for the supplied ID." />
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-outline-variant bg-surface-container-low p-4">
      <p className="label-caps">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-outline-variant bg-black/10 px-3 py-1 text-[11px] text-on-surface-variant">
      <span className="text-white">{value}</span> {label}
    </span>
  );
}

function SelectedNeedSummary({
  need,
  result,
}: {
  need: Need;
  result: MatchResult | undefined;
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-black/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-caps">Selected need</p>
          <p className="mt-2 text-lg font-black text-white">{need.summary}</p>
          <p className="mt-1 text-sm text-on-surface-variant">{sentence(need.category)}</p>
        </div>
        <StatusBadge tone={toneForStatus(need.priorityLevel)}>{need.priorityLevel}</StatusBadge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <InfoCard label="Required skills" value={String(result?.need.requiredSkills.length ?? need.skills.length)} />
        <InfoCard label="Top score" value={result?.matches[0] ? formatPercent(result.matches[0].matchScore, 0) : "No match"} />
        <InfoCard label="Assignment pace" value={priorityCopy[need.priorityLevel] ?? "Review manually"} />
      </div>
    </div>
  );
}

function readinessLabel(score: number) {
  if (score >= 0.8) {
    return "Ready now";
  }

  if (score >= 0.6) {
    return "Good fit";
  }

  if (score >= 0.4) {
    return "Review closely";
  }

  return "Fallback option";
}
