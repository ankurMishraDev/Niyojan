import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button, InlineError, LoaderBlock, MetricCard, PageHeader, Panel, Select, StatusBadge } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { getApiErrorMessage } from "@/lib/api";
import { dashboardApi, onboardingApi } from "@/lib/services";
import { formatDateTime, formatNumber, toneForStatus } from "@/lib/format";
import type { UserProfile } from "@/types/api";

export function DashboardPage() {
  const { user } = useAuth();

  if (user?.role !== "superadmin") {
    return <NgoDashboard user={user} />;
  }

  return <AdminDashboard user={user} />;
}

function NgoDashboard({ user }: { user: UserProfile | null }) {
  const { t } = useTranslation();
  const isVolunteer = user?.role === "volunteer";
  const submittedSurveysQuery = useQuery({
    enabled: !isVolunteer,
    queryKey: ["ngo-dashboard-submitted-surveys"],
    queryFn: () => dashboardApi.submittedSurveys(),
  });

  if (isVolunteer) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto py-8 px-4 sm:px-6">
        <PageHeader
          eyebrow="Workspace"
          title={t("Volunteer_Dashboard_Header_Welcome")}
          description={t("Volunteer_Dashboard_Text_Overview")}
        />

        <div className="grid gap-6 md:grid-cols-2">
          <Link className="block group" to="/feedback">
            <Panel className="h-full transition-transform hover:-translate-y-1">
              <p className="label-caps">{t("Common_Navigation_Link_Feedback")}</p>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink group-hover:text-link">{t("Volunteer_Feedback_Header_SubmitFeedback")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-body">
                Record visit outcomes and evidence for assigned cases.
              </p>
            </Panel>
          </Link>
          <Link className="block group" to="/profile">
            <Panel className="h-full transition-transform hover:-translate-y-1">
              <p className="label-caps">{t("Common_Navigation_Link_Profile")}</p>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink group-hover:text-link">{t("Volunteer_Profile_Header_ProfileSettings")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-body">
                Confirm the active account, organization scope, and contact identity.
              </p>
            </Panel>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <PageHeader
        eyebrow="NGO Workspace"
        title={user?.organizationName ? `${user.organizationName} dashboard` : t("NGO_Dashboard_Header_Welcome")}
        description={t("NGO_Dashboard_Text_Overview")}
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Link className="block group" to="/form-builder">
          <Panel className="h-full transition-transform hover:-translate-y-1">
            <p className="label-caps">{t("Common_Navigation_Link_FormBuilder")}</p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink group-hover:text-link">{t("NGO_FormBuilder_Header_CreateForm")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-body">
              Build reusable intake forms for your field teams and survey collection.
            </p>
          </Panel>
        </Link>

        <Link className="block group" to="/surveys/new">
          <Panel className="h-full transition-transform hover:-translate-y-1 bg-canvas-soft border-hairline-strong">
            <p className="label-caps">{t("Common_Navigation_Link_DataCollection")}</p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink group-hover:text-link">{t("NGO_Survey_Header_DataCollection")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-body">
              Select a published template, enter beneficiary responses, and submit for analysis.
            </p>
          </Panel>
        </Link>

        <Link className="block group" to="/feedback">
          <Panel className="h-full transition-transform hover:-translate-y-1">
            <p className="label-caps">{t("Common_Navigation_Link_Feedback")}</p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink group-hover:text-link">{t("NGO_Feedback_Header_CaseFeedback")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-body">
              {t("NGO_Feedback_Text_ReviewFeedback")}
            </p>
          </Panel>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Panel className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="label-caps">Account Scope</p>
            <Link className="action-button-secondary text-xs py-1.5 px-3" to="/profile">
              {t("Common_Navigation_Link_Profile")}
            </Link>
          </div>
          <div>
            <p className="text-xl font-semibold tracking-tight text-ink">{user?.name}</p>
            <p className="mt-1 text-sm text-body">{user?.email}</p>
          </div>
          {user?.organizationName ? (
            <div className="mt-auto pt-4 border-t border-hairline">
              <p className="text-sm font-medium text-ink">{user.organizationName}</p>
              <p className="text-xs text-mute">Active Organization</p>
            </div>
          ) : null}
        </Panel>

        <Panel className="space-y-6">
          <div>
            <p className="text-xl font-semibold tracking-tight text-ink">{t("NGO_Dashboard_Metric_TotalSurveys")}</p>
            <p className="mt-1 text-sm text-body">
              Review your past submissions and open the volunteer feedback response linked to each case.
            </p>
          </div>

          {submittedSurveysQuery.isLoading ? (
            <LoaderBlock label="Loading submitted surveys…" />
          ) : submittedSurveysQuery.isError ? (
            <InlineError
              message={getApiErrorMessage(submittedSurveysQuery.error)}
              onRetry={() => void submittedSurveysQuery.refetch()}
            />
          ) : (
            <div className="space-y-4">
              {(submittedSurveysQuery.data ?? []).map((survey) => (
                <div className="rounded-md border border-hairline bg-canvas-soft-2 p-5" key={survey.id}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-ink">{survey.respondentName || "Unnamed respondent"}</p>
                      <p className="mt-1 text-xs font-mono text-mute">{survey.id}</p>
                      <p className="mt-1.5 text-sm text-body">{survey.locationText || "No location"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge tone={toneForStatus(survey.priorityLevel)}>{survey.priorityLevel}</StatusBadge>
                      <StatusBadge tone={toneForStatus(survey.caseStatus)}>{survey.caseStatus}</StatusBadge>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-body border-t border-hairline pt-4">
                    <span>Submitted {formatDateTime(survey.submittedAt || survey.createdAt)}</span>
                    <span className="w-1 h-1 rounded-full bg-mute/50"></span>
                    <span>{survey.needCount} need(s)</span>
                    <span className="w-1 h-1 rounded-full bg-mute/50"></span>
                    <span>{survey.feedbackSubmitted ? "Volunteer feedback submitted" : "Waiting for volunteer feedback"}</span>
                    {survey.volunteerName ? (
                      <>
                        <span className="w-1 h-1 rounded-full bg-mute/50"></span>
                        <span>Volunteer: {survey.volunteerName}</span>
                      </>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link className="action-button-secondary text-xs" to={`/surveys/${survey.id}`}>
                      View survey
                    </Link>
                    {survey.assignmentId ? (
                      <Link className="action-button-secondary text-xs" to={`/feedback/assignments/${survey.assignmentId}`}>
                        Open feedback response
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
              {submittedSurveysQuery.data?.length === 0 ? (
                <div className="py-8 text-center text-sm text-mute">
                  No surveys submitted yet.
                </div>
              ) : null}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function AdminDashboard({ user }: { user: UserProfile | null }) {
  const queryClient = useQueryClient();
  const [priorityFilter, setPriorityFilter] = useState("");
  const [caseStatusFilter, setCaseStatusFilter] = useState("");
  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: dashboardApi.summary,
  });
  const submittedSurveysQuery = useQuery({
    queryKey: ["dashboard-submitted-surveys", priorityFilter, caseStatusFilter],
    queryFn: () =>
      dashboardApi.submittedSurveys({
        priority: priorityFilter || undefined,
        case_status: caseStatusFilter || undefined,
      }),
  });
  const volunteerAvailabilityQuery = useQuery({
    queryKey: ["dashboard-volunteer-availability"],
    queryFn: dashboardApi.volunteerAvailability,
  });
  const pipelineHealthQuery = useQuery({
    queryKey: ["dashboard-pipeline-health"],
    queryFn: dashboardApi.pipelineHealth,
  });
  const pendingNgosQuery = useQuery({
    enabled: user?.role === "superadmin",
    queryKey: ["pending-ngos"],
    queryFn: () => onboardingApi.listNgos({ status: "pending" }),
  });
  const approveMutation = useMutation({
    mutationFn: (orgId: string) => onboardingApi.approveNgo(orgId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pending-ngos"] });
    },
  });
  const rejectMutation = useMutation({
    mutationFn: (orgId: string) => onboardingApi.rejectNgo(orgId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pending-ngos"] });
    },
  });

  const isInitialLoading =
    summaryQuery.isLoading &&
    submittedSurveysQuery.isLoading &&
    volunteerAvailabilityQuery.isLoading &&
    pipelineHealthQuery.isLoading;

  if (isInitialLoading) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4">
        <LoaderBlock label="Loading dashboard…" />
      </div>
    );
  }

  const summary = summaryQuery.data ?? {
    activeNeeds: 0,
    availableVolunteers: 0,
    pendingReviews: 0,
    submittedSurveys: 0,
  };
  const submittedSurveys = submittedSurveysQuery.data ?? [];
  const volunteerAvailability = volunteerAvailabilityQuery.data ?? {
    breakdown: [],
    totalActiveVolunteers: 0,
  };
  const pipelineHealth = pipelineHealthQuery.data ?? {
    queueDepth: 0,
    processingDocuments: 0,
    jobStatusBreakdown: [],
    recentFailures: [],
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <PageHeader
        eyebrow="Overview"
        title="Command Dashboard"
        description="Monitor overall system activity, review submitted data, and manage NGO onboarding applications."
      />

      {summaryQuery.isError ? (
        <InlineError
          message={getApiErrorMessage(summaryQuery.error)}
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Active needs" value={formatNumber(summary.activeNeeds)} />
        <MetricCard label="Available volunteers" value={formatNumber(summary.availableVolunteers)} />
        <MetricCard label="Pending reviews" value={formatNumber(summary.pendingReviews)} />
        <MetricCard label="Submitted surveys" value={formatNumber(summary.submittedSurveys)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_380px]">
        <Panel className="overflow-hidden p-0 flex flex-col shadow-card-medium">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-hairline px-6 py-5 gap-4">
            <div>
              <p className="text-xl font-semibold tracking-tight text-ink">Submitted surveys</p>
              <p className="mt-1.5 text-sm text-body">
                All submitted survey cases with derived priority and operational state.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Select className="py-1.5 text-xs w-full sm:w-auto" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                <option value="">All priorities</option>
                <option value="critical">critical</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </Select>
              <Select className="py-1.5 text-xs w-full sm:w-auto" value={caseStatusFilter} onChange={(event) => setCaseStatusFilter(event.target.value)}>
                <option value="">All cases</option>
                <option value="open">open</option>
                <option value="resolved">resolved</option>
              </Select>
            </div>
          </div>

          {submittedSurveysQuery.isError ? (
            <div className="p-4">
              <InlineError
                message={getApiErrorMessage(submittedSurveysQuery.error)}
                onRetry={() => void submittedSurveysQuery.refetch()}
              />
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-canvas-soft text-body border-b border-hairline">
                <tr>
                  <th className="px-6 py-3 font-medium">Survey</th>
                  <th className="px-6 py-3 font-medium hidden md:table-cell">Location</th>
                  <th className="px-6 py-3 font-medium">Priority</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Needs</th>
                  <th className="px-6 py-3 font-medium hidden lg:table-cell">Submitted</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {submittedSurveys.map((survey) => (
                  <tr
                    className="hover:bg-canvas-soft-2 transition-colors"
                    key={survey.id}
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-ink">{survey.respondentName || "Unnamed respondent"}</p>
                      <p className="mt-1 font-mono text-[10px] text-mute">
                        {survey.id}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-body hidden md:table-cell">
                      <div className="truncate max-w-[180px]" title={survey.locationText || "Unspecified"}>
                        {survey.locationText ?? "Unspecified"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge tone={toneForStatus(survey.priorityLevel)}>
                        {survey.priorityLevel}
                      </StatusBadge>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge tone={toneForStatus(survey.caseStatus)}>{survey.caseStatus}</StatusBadge>
                    </td>
                    <td className="px-6 py-4 text-body text-right">
                      {formatNumber(survey.needCount)}
                    </td>
                    <td className="px-6 py-4 text-body text-xs hidden lg:table-cell">
                      {formatDateTime(survey.submittedAt || survey.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link className="action-button-secondary text-xs" to={`/surveys/${survey.id}`}>
                        View survey
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {submittedSurveys.length === 0 && (
              <div className="p-8 text-center text-body text-sm">
                No surveys found matching filters.
              </div>
            )}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel className="space-y-5">
            <div>
              <p className="text-lg font-semibold tracking-tight text-ink">Pipeline health</p>
              <p className="mt-1 text-xs text-body">
                Queue depth and recent failures from background orchestration.
              </p>
            </div>

            {pipelineHealthQuery.isError ? (
              <InlineError
                message={getApiErrorMessage(pipelineHealthQuery.error)}
                onRetry={() => void pipelineHealthQuery.refetch()}
              />
            ) : null}

            <div className="grid gap-3 grid-cols-2">
              <div className="rounded-md border border-hairline bg-canvas-soft-2 p-4 text-center">
                <p className="label-caps mb-2">Queue depth</p>
                <p className="text-3xl font-semibold tracking-tight text-ink">
                  {formatNumber(pipelineHealth.queueDepth)}
                </p>
              </div>
              <div className="rounded-md border border-hairline bg-canvas-soft-2 p-4 text-center">
                <p className="label-caps mb-2">Processing</p>
                <p className="text-3xl font-semibold tracking-tight text-ink">
                  {formatNumber(pipelineHealth.processingDocuments)}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-hairline">
              {pipelineHealth.jobStatusBreakdown.map((item) => (
                <div className="flex items-center justify-between gap-3 text-sm" key={item.status}>
                  <span className="text-body">{item.status}</span>
                  <span className="font-semibold text-ink">{formatNumber(item.count)}</span>
                </div>
              ))}
            </div>

            {pipelineHealth.recentFailures.length > 0 ? (
              <div className="space-y-3 rounded-md border border-danger/20 bg-danger/5 p-4 mt-2">
                <p className="label-caps text-danger">Recent failures</p>
                {pipelineHealth.recentFailures.map((failure) => (
                  <div key={failure.id} className="text-sm">
                    <p className="font-semibold text-ink">{failure.type}</p>
                    <p className="text-xs text-body mt-0.5">
                      <span className="font-mono">{failure.entityType}:{failure.entityId}</span>
                      <span className="mx-1">•</span>
                      {formatDateTime(failure.updatedAt)}
                    </p>
                    <p className="mt-1.5 text-xs text-danger break-words">
                      {failure.errorMessage ?? "Unknown job failure"}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </Panel>

          <Panel className="space-y-5">
            <div>
              <p className="text-lg font-semibold tracking-tight text-ink">Volunteer availability</p>
              <p className="mt-1 text-xs text-body">
                Live active volunteer breakdown across availability states.
              </p>
            </div>

            {volunteerAvailabilityQuery.isError ? (
              <InlineError
                message={getApiErrorMessage(volunteerAvailabilityQuery.error)}
                onRetry={() => void volunteerAvailabilityQuery.refetch()}
              />
            ) : null}

            <div className="rounded-md border border-hairline bg-canvas-soft-2 p-4 flex items-center justify-between">
              <p className="font-medium text-sm text-body">Total active</p>
              <p className="text-xl font-semibold tracking-tight text-ink">
                {formatNumber(volunteerAvailability.totalActiveVolunteers)}
              </p>
            </div>
            
            <div className="space-y-3 pt-2">
              {volunteerAvailability.breakdown.map((item) => (
                <div className="flex items-center justify-between text-sm" key={item.availabilityStatus}>
                  <span className="text-body capitalize">{item.availabilityStatus}</span>
                  <span className="font-semibold text-ink">{item.count}</span>
                </div>
              ))}
            </div>
          </Panel>

          {user?.role === "superadmin" ? (
            <Panel className="space-y-5 border-warning/30">
              <div>
                <p className="text-lg font-semibold tracking-tight text-ink">Pending NGO onboarding</p>
                <p className="mt-1 text-xs text-body">
                  Review organizations awaiting approval.
                </p>
              </div>

              {pendingNgosQuery.isError ? (
                <InlineError
                  message={getApiErrorMessage(pendingNgosQuery.error)}
                  onRetry={() => void pendingNgosQuery.refetch()}
                />
              ) : null}

              <div className="space-y-4">
                {(pendingNgosQuery.data ?? []).map((organization) => (
                  <div
                    className="rounded-md border border-hairline bg-canvas-soft-2 p-4"
                    key={organization.id}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-semibold text-ink">{organization.name}</p>
                        <p className="mt-1 text-xs text-body">
                          {organization.region ?? "Region pending"}
                          <span className="mx-1.5">•</span>
                          {organization.primaryAdmin?.email ?? "No primary admin"}
                        </p>
                      </div>
                      <StatusBadge tone="warning">{organization.status}</StatusBadge>
                    </div>
                    <div className="flex gap-2 w-full pt-3 border-t border-hairline">
                      <Button
                        className="flex-1 text-xs py-1.5"
                        disabled={approveMutation.isPending}
                        onClick={() => void approveMutation.mutate(organization.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        className="flex-1 text-xs py-1.5"
                        disabled={rejectMutation.isPending}
                        onClick={() => void rejectMutation.mutate(organization.id)}
                        variant="secondary"
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
                {pendingNgosQuery.data?.length === 0 ? (
                  <div className="text-sm text-mute text-center py-4 bg-canvas-soft-2 rounded border border-hairline border-dashed">
                    No pending NGO registrations.
                  </div>
                ) : null}
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
