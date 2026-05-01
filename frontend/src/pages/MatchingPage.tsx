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
        eyebrow="Manual Volunteer System"
        title="Survey Matching"
        description="Search by submitted survey ID, review the case needs, find the nearest volunteers, filter them by profession domain, and assign the case manually."
      />

      <Panel className="space-y-4">
        <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={onSearch}>
          <Input
            placeholder="Paste submitted survey ID"
            value={searchSurveyId}
            onChange={(event) => setSearchSurveyId(event.target.value)}
          />
          <Button type="submit">Find nearest volunteers</Button>
        </form>
        <div className="grid gap-4 md:grid-cols-2">
          <Select value={selectedDomain} onChange={(event) => setSelectedDomain(event.target.value)}>
            <option value="">All profession domains</option>
            {(optionsQuery.data?.domains ?? []).map((domain) => (
              <option key={domain} value={domain}>
                {sentence(domain)}
              </option>
            ))}
          </Select>
          <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            {surveyId ? `Selected survey: ${surveyId}` : "Enter a survey ID to load the case and nearby volunteers."}
          </div>
        </div>
      </Panel>

      {!surveyId ? null : surveyQuery.isLoading || needsQuery.isLoading || reviewQuery.isLoading ? (
        <LoaderBlock label="Loading survey case and nearest volunteers..." />
      ) : surveyQuery.data ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <Panel className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-black text-white">Submitted survey</p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {surveyQuery.data.respondentName || "Unnamed respondent"}
                  </p>
                </div>
                <StatusBadge tone={toneForStatus(surveyQuery.data.status)}>{surveyQuery.data.status}</StatusBadge>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard label="Location" value={surveyQuery.data.locationText || "No location"} />
                <InfoCard label="Submitted" value={formatDateTime(surveyQuery.data.submittedAt)} />
              </div>
              <Panel className="bg-surface-container-low">
                <p className="label-caps">AI case summary</p>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                  {String(reviewQuery.data?.reasoningOutput?.case_summary || "AI review summary is not available yet.")}
                </p>
              </Panel>
            </Panel>

            <Panel className="space-y-4">
              <div>
                <p className="text-xl font-black text-white">Survey needs</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Select the need that best represents the volunteer assignment. If no need exists, you can still assign the survey for manual support.
                </p>
              </div>
              {needs.length === 0 ? (
                <p className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                  No AI-generated needs were found for this survey. You can still assign the case manually based on the full survey and AI assessment.
                </p>
              ) : (
                <div className="space-y-3">
                  {needs.map((need) => (
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
                          <p className="mt-1 text-xs text-on-surface-variant">{sentence(need.category)}</p>
                        </div>
                        <StatusBadge tone={toneForStatus(need.priorityLevel)}>{need.priorityLevel}</StatusBadge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <Panel className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xl font-black text-white">Nearest volunteers</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Volunteers are ordered from nearest to farthest using the submitted survey coordinates.
                </p>
              </div>
              <StatusBadge tone="success">{rankedVolunteers.length} found</StatusBadge>
            </div>

            {volunteersQuery.isLoading ? (
              <LoaderBlock label="Finding nearest volunteers..." />
            ) : rankedVolunteers.length === 0 ? (
              <p className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                No volunteers matched the current domain filter.
              </p>
            ) : (
              <div className="space-y-4">
                {rankedVolunteers.map((volunteer) => (
                  <Panel className="space-y-4 bg-surface-container-low" key={volunteer.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xl font-black text-white">{volunteer.name || volunteer.profession || volunteer.id}</p>
                        <p className="mt-1 text-sm text-on-surface-variant">{volunteer.email || volunteer.profession || "No profession provided"}</p>
                      </div>
                      <StatusBadge tone="success">{formatDistance(volunteer.distanceKm)}</StatusBadge>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <InfoCard label="Volunteer ID" value={volunteer.id} />
                      <InfoCard label="Domain" value={sentence(volunteer.effectiveDomain || "other")} />
                      <InfoCard label="Availability" value={volunteer.availabilityStatus} />
                      <InfoCard label="Manual fit score" value={formatPercent(volunteer.manualScore, 0)} />
                    </div>

                    <div>
                      <p className="label-caps">Matched skills</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {volunteer.matchedSkills.length > 0 ? volunteer.matchedSkills.map((skill) => (
                          <span
                            className="rounded-md border border-primary/50 bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-primary"
                            key={`${volunteer.id}-${skill}`}
                          >
                            {skill}
                          </span>
                        )) : <span className="text-xs text-on-surface-variant">No skill overlap detected</span>}
                      </div>
                    </div>

                    {volunteer.missingSkills.length > 0 ? (
                      <div>
                        <p className="label-caps">Missing skills</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {volunteer.missingSkills.map((skill) => (
                            <span
                              className="rounded-md border border-warning/50 bg-warning/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-warning"
                              key={`${volunteer.id}-missing-${skill}`}
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm leading-6 text-on-surface-variant">
                        {selectedNeed
                          ? `${volunteer.id} is ${formatDistance(volunteer.distanceKm)} away and has ${volunteer.matchedSkills.length} matched skill(s) for the selected need.`
                          : `${volunteer.id} is ${formatDistance(volunteer.distanceKm)} away from the submitted survey location and can be assigned for manual support.`}
                      </p>
                      <Button
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
                        {assignMutation.isPending ? "Assigning..." : "Assign"}
                      </Button>
                    </div>
                  </Panel>
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
    <div className="rounded-md border border-outline-variant bg-surface-container-low p-4">
      <p className="label-caps">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
