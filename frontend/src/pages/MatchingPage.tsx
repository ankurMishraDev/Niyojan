import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input, LoaderBlock, PageHeader, Panel, Select, StatusBadge } from "@/components/ui";
import { assignmentsApi, authApi, needsApi, pipelineApi, surveysApi, volunteersApi } from "@/lib/services";
import { formatDateTime, formatPercent, sentence, toneForStatus } from "@/lib/format";
import { inferVolunteerDomain } from "@/lib/volunteerDomains";

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineKm = (
  fromLat: number | null,
  fromLon: number | null,
  toLat: number | null,
  toLon: number | null,
) => {
  if (fromLat === null || fromLon === null || toLat === null || toLon === null) {
    return null;
  }

  const earthRadiusKm = 6371;
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLon = toRadians(toLon - fromLon);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Number((earthRadiusKm * c).toFixed(2));
};

const availabilityScore = (status: string) => {
  if (status === "available") return 1;
  if (status === "limited" || status === "part_time") return 0.65;
  if (status === "busy") return 0.3;
  return 0.1;
};

const locationScore = (distanceKm: number | null) => {
  if (distanceKm === null) return 0;
  if (distanceKm <= 10) return 1;
  if (distanceKm <= 25) return 0.8;
  if (distanceKm <= 50) return 0.6;
  if (distanceKm <= 100) return 0.35;
  return 0.15;
};

const formatDistance = (distanceKm: number | null) => {
  if (distanceKm === null) {
    return "Unknown distance";
  }

  return `${distanceKm} km`;
};

export function MatchingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchSurveyId, setSearchSurveyId] = useState(searchParams.get("surveyId") ?? "");
  const [selectedNeedId, setSelectedNeedId] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("");
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

  const volunteersQuery = useQuery({
    enabled: Boolean(surveyId),
    queryKey: ["matching-volunteers", surveyId],
    queryFn: () =>
      volunteersApi.list({
        page: 1,
        pageSize: 100,
        is_active: "true",
      }),
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

  const selectedNeed = useMemo(
    () => needs.find((need) => need.id === selectedNeedId) ?? null,
    [needs, selectedNeedId],
  );

  const rankedVolunteers = useMemo(() => {
    const survey = surveyQuery.data;
    const volunteers = volunteersQuery.data?.items ?? [];
    if (!survey) {
      return [];
    }

    const needSkillKeys = new Set(selectedNeed?.skills.map((skill) => skill.key) ?? []);

    return volunteers
      .filter((volunteer) => {
        if (!selectedDomain) {
          return true;
        }

        const effectiveDomain = inferVolunteerDomain({
          primaryDomain: volunteer.primaryDomain,
          profession: volunteer.profession,
          profileSummary: volunteer.profileSummary,
          skills: volunteer.skills,
        });

        return effectiveDomain === selectedDomain;
      })
      .map((volunteer) => {
        const volunteerSkillKeys = volunteer.skills.map((skill) => skill.key);
        const matchedSkills = volunteerSkillKeys.filter((skill) => needSkillKeys.has(skill));
        const missingSkills = [...needSkillKeys].filter((skill) => !volunteerSkillKeys.includes(skill));
        const skillScore = needSkillKeys.size === 0 ? 0.5 : matchedSkills.length / needSkillKeys.size;
        const distanceKm = haversineKm(survey.latitude, survey.longitude, volunteer.latitude, volunteer.longitude);
        const location = locationScore(distanceKm);
        const availability = availabilityScore(volunteer.availabilityStatus);
        const manualScore = Number((skillScore * 0.35 + location * 0.45 + availability * 0.2).toFixed(2));

        return {
          ...volunteer,
          effectiveDomain: inferVolunteerDomain({
            primaryDomain: volunteer.primaryDomain,
            profession: volunteer.profession,
            profileSummary: volunteer.profileSummary,
            skills: volunteer.skills,
          }),
          distanceKm,
          matchedSkills,
          missingSkills,
          manualScore,
        };
      })
      .sort((left, right) => {
        if (left.distanceKm === null && right.distanceKm !== null) return 1;
        if (left.distanceKm !== null && right.distanceKm === null) return -1;
        if (left.distanceKm !== null && right.distanceKm !== null && left.distanceKm !== right.distanceKm) {
          return left.distanceKm - right.distanceKm;
        }

        return right.manualScore - left.manualScore || left.createdAt.localeCompare(right.createdAt);
      });
  }, [selectedDomain, selectedNeed, surveyQuery.data, volunteersQuery.data?.items]);

  const assignMutation = useMutation({
    mutationFn: (payload: {
      volunteerId: string;
      distanceKm: number | null;
      manualScore: number;
      matchedSkills: string[];
      missingSkills: string[];
      volunteerName: string;
      volunteerDomain: string | null | undefined;
      volunteerProfession: string | null | undefined;
    }) =>
      assignmentsApi.create({
        survey_id: surveyId,
        need_id: selectedNeed?.id || undefined,
        volunteer_id: payload.volunteerId,
        status: "suggested",
        match_score: payload.manualScore,
        match_reason_json: {
          assignment_mode: "manual_nearest",
          survey_id: surveyId,
          selected_need_id: selectedNeed?.id || null,
          selected_need_summary: selectedNeed?.summary || null,
          ai_review_summary: reviewQuery.data?.reasoningOutput?.case_summary || null,
          ai_review_assessment: reviewQuery.data?.reasoningOutput || null,
          volunteer_name: payload.volunteerName,
          volunteer_domain: payload.volunteerDomain || null,
          volunteer_profession: payload.volunteerProfession || null,
          distance_km: payload.distanceKm,
          matched_skills: payload.matchedSkills,
          missing_skills: payload.missingSkills,
          explanation: `${payload.volunteerName} was selected manually based on nearest availability${payload.volunteerDomain ? ` and ${payload.volunteerDomain} domain fit` : ""}.`,
        },
      }),
    onSuccess: (assignment) => {
      navigate("/assignments", { state: { assignmentId: assignment.id } });
    },
  });

  if (optionsQuery.isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4">
        <LoaderBlock label="Loading matching workspace…" />
      </div>
    );
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
    <div className="space-y-6 max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <PageHeader
        eyebrow="Manual Volunteer System"
        title="Survey Matching"
        description="Search by submitted survey ID, review the case needs, find the nearest volunteers, filter them by profession domain, and assign the case manually."
      />

      <Panel className="space-y-5">
        <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={onSearch}>
          <Input
            placeholder="Paste submitted survey ID"
            value={searchSurveyId}
            onChange={(event) => setSearchSurveyId(event.target.value)}
          />
          <Button type="submit">Find nearest volunteers</Button>
        </form>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select value={selectedDomain} onChange={(event) => setSelectedDomain(event.target.value)}>
            <option value="">All profession domains</option>
            {(optionsQuery.data?.domains ?? []).map((domain) => (
              <option key={domain} value={domain}>
                {sentence(domain)}
              </option>
            ))}
          </Select>
          <div className="rounded-md border border-hairline bg-canvas-soft-2 px-4 py-2.5 text-sm text-body flex items-center">
            {surveyId ? `Selected survey: ${surveyId}` : "Enter a survey ID to load the case and nearby volunteers."}
          </div>
        </div>
      </Panel>

      {!surveyId ? null : surveyQuery.isLoading || needsQuery.isLoading || reviewQuery.isLoading ? (
        <LoaderBlock label="Loading survey case and nearest volunteers…" />
      ) : surveyQuery.data ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-6">
            <Panel className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold tracking-tight text-ink">Submitted survey</p>
                  <p className="mt-1 text-sm text-body">
                    {surveyQuery.data.respondentName || "Unnamed respondent"}
                  </p>
                </div>
                <StatusBadge tone={toneForStatus(surveyQuery.data.status)}>{surveyQuery.data.status}</StatusBadge>
              </div>
              <div className="grid gap-3 grid-cols-2">
                <InfoCard label="Location" value={surveyQuery.data.locationText || "No location"} />
                <InfoCard label="Submitted" value={formatDateTime(surveyQuery.data.submittedAt)} />
              </div>
              <div className="rounded-md border border-hairline bg-canvas-soft-2 p-5">
                <p className="label-caps mb-2">AI case summary</p>
                <p className="text-sm leading-relaxed text-body">
                  {String(reviewQuery.data?.reasoningOutput?.case_summary || "AI review summary is not available yet.")}
                </p>
              </div>
            </Panel>

            <Panel className="space-y-5">
              <div>
                <p className="text-xl font-semibold tracking-tight text-ink">Survey needs</p>
                <p className="mt-1 text-sm text-body">
                  Select the need that best represents the volunteer assignment. If no need exists, you can still assign the survey for manual support.
                </p>
              </div>
              {needs.length === 0 ? (
                <div className="rounded-md border border-hairline border-dashed bg-canvas-soft-2 px-4 py-4 text-sm text-body text-center">
                  No AI-generated needs were found for this survey. You can still assign the case manually based on the full survey and AI assessment.
                </div>
              ) : (
                <div className="space-y-3">
                  {needs.map((need) => (
                    <button
                      className={`w-full rounded-md border px-4 py-4 text-left transition-colors ${
                        selectedNeedId === need.id
                          ? "border-ink bg-canvas-soft shadow-sm"
                          : "border-hairline bg-canvas hover:border-hairline-strong hover:bg-canvas-soft-2"
                      }`}
                      key={need.id}
                      onClick={() => setSelectedNeedId(need.id)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink">{need.summary}</p>
                          <p className="mt-1 font-mono text-[10px] text-mute">{sentence(need.category)}</p>
                        </div>
                        <StatusBadge tone={toneForStatus(need.priorityLevel)}>{need.priorityLevel}</StatusBadge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <Panel className="space-y-5 bg-canvas-soft">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-hairline">
              <div>
                <p className="text-xl font-semibold tracking-tight text-ink">Nearest volunteers</p>
                <p className="mt-1 text-sm text-body max-w-sm">
                  Volunteers are ordered from nearest to farthest using the submitted survey coordinates.
                </p>
              </div>
              <StatusBadge tone="success">{rankedVolunteers.length} found</StatusBadge>
            </div>

            {volunteersQuery.isLoading ? (
              <LoaderBlock label="Finding nearest volunteers…" />
            ) : rankedVolunteers.length === 0 ? (
              <div className="rounded-md border border-hairline border-dashed bg-canvas px-4 py-8 text-center text-sm text-body">
                No volunteers matched the current domain filter.
              </div>
            ) : (
              <div className="space-y-4">
                {rankedVolunteers.map((volunteer) => (
                  <div className="rounded-md border border-hairline bg-canvas p-5 shadow-sm" key={volunteer.id}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                      <div>
                        <p className="text-lg font-semibold tracking-tight text-ink">{volunteer.name || volunteer.profession || volunteer.id}</p>
                        <p className="mt-0.5 text-sm text-body">{volunteer.email || volunteer.profession || "No profession provided"}</p>
                      </div>
                      <StatusBadge tone="success">{formatDistance(volunteer.distanceKm)}</StatusBadge>
                    </div>

                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-4">
                      <div className="space-y-1">
                        <p className="label-caps">Domain</p>
                        <p className="text-sm font-medium text-ink">{sentence(volunteer.effectiveDomain || "other")}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="label-caps">Availability</p>
                        <p className="text-sm font-medium text-ink capitalize">{volunteer.availabilityStatus}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="label-caps">Fit Score</p>
                        <p className="text-sm font-medium text-ink">{formatPercent(volunteer.manualScore, 0)}</p>
                      </div>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-hairline mb-4">
                      <div>
                        <p className="label-caps mb-1.5">Matched skills</p>
                        <div className="flex flex-wrap gap-1.5">
                          {volunteer.matchedSkills.length > 0 ? volunteer.matchedSkills.map((skill) => (
                            <span
                              className="rounded bg-canvas-soft border border-hairline px-2 py-0.5 text-[10px] font-mono text-ink"
                              key={`${volunteer.id}-${skill}`}
                            >
                              {skill}
                            </span>
                          )) : <span className="text-xs text-mute italic">No skill overlap detected</span>}
                        </div>
                      </div>

                      {volunteer.missingSkills.length > 0 ? (
                        <div>
                          <p className="label-caps mb-1.5 text-danger">Missing skills</p>
                          <div className="flex flex-wrap gap-1.5">
                            {volunteer.missingSkills.map((skill) => (
                              <span
                                className="rounded bg-danger/5 border border-danger/20 px-2 py-0.5 text-[10px] font-mono text-danger"
                                key={`${volunteer.id}-missing-${skill}`}
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-hairline bg-canvas-soft -mx-5 -mb-5 px-5 py-4 rounded-b-md">
                      <p className="text-xs leading-relaxed text-body">
                        {selectedNeed
                          ? `${volunteer.name || volunteer.id} is ${formatDistance(volunteer.distanceKm)} away and has ${volunteer.matchedSkills.length} matched skill(s) for the selected need.`
                          : `${volunteer.name || volunteer.id} is ${formatDistance(volunteer.distanceKm)} away from the submitted survey location and can be assigned for manual support.`}
                      </p>
                      <Button
                        className="w-full sm:w-auto shrink-0 text-xs py-1.5 px-4"
                        disabled={assignMutation.isPending}
                        onClick={() =>
                          void assignMutation.mutate({
                            volunteerId: volunteer.id,
                            distanceKm: volunteer.distanceKm,
                            manualScore: volunteer.manualScore,
                            matchedSkills: volunteer.matchedSkills,
                            missingSkills: volunteer.missingSkills,
                            volunteerName: volunteer.name || volunteer.profession || volunteer.id,
                            volunteerDomain: volunteer.effectiveDomain,
                            volunteerProfession: volunteer.profession,
                          })
                        }
                      >
                        {assignMutation.isPending ? "Assigning…" : "Assign to Case"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      ) : (
        <LoaderBlock label="Survey not found for the supplied ID." />
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-hairline bg-canvas p-4 shadow-sm">
      <p className="label-caps">{label}</p>
      <p className="mt-1.5 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}
