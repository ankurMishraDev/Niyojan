import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button, InlineError, LoaderBlock, MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
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
  const isVolunteer = user?.role === "volunteer";

  if (isVolunteer) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Workspace"
          title="Volunteer Dashboard"
          description="Review assigned work, submit feedback, and keep your profile current."
        />

        <div className="grid gap-3 md:grid-cols-2">
          <Link className="block" to="/feedback">
            <Panel className="h-full transition hover:border-primary/60">
              <p className="label-caps text-primary">Feedback</p>
              <h2 className="mt-3 text-2xl font-black text-white">Submit field feedback</h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                Record visit outcomes and evidence for assigned cases.
              </p>
            </Panel>
          </Link>
          <Link className="block" to="/profile">
            <Panel className="h-full transition hover:border-primary/60">
              <p className="label-caps text-primary">Profile</p>
              <h2 className="mt-3 text-2xl font-black text-white">View volunteer identity</h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                Confirm the active account, organization scope, and contact identity.
              </p>
            </Panel>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="NGO Workspace"
        title={user?.organizationName ? `${user.organizationName} dashboard` : "NGO Dashboard"}
        description="Create templates, collect survey data, and submit feedback without admin-only operations tooling."
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Link className="block" to="/form-builder">
          <Panel className="h-full transition hover:border-primary/60">
            <p className="label-caps text-primary">Form Templates</p>
            <h2 className="mt-3 text-2xl font-black text-white">Create or update templates</h2>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Build reusable intake forms for your field teams and survey collection.
            </p>
          </Panel>
        </Link>

        <Link className="block" to="/surveys/new">
          <Panel className="h-full transition hover:border-primary/60">
            <p className="label-caps text-primary">Data Collection</p>
            <h2 className="mt-3 text-2xl font-black text-white">Submit collected data</h2>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Select a published template, enter beneficiary responses, and submit for analysis.
            </p>
          </Panel>
        </Link>

        <Link className="block" to="/feedback">
          <Panel className="h-full transition hover:border-primary/60">
            <p className="label-caps text-primary">Feedback</p>
            <h2 className="mt-3 text-2xl font-black text-white">Review field feedback</h2>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Track case outcomes and submit follow-up feedback when assigned.
            </p>
          </Panel>
        </Link>
      </div>

      <Panel className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="label-caps text-on-surface-variant">Account Scope</p>
          <p className="mt-2 text-lg font-black text-white">{user?.name}</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            {user?.email} · {user?.role?.replace("_", " ")}
          </p>
        </div>
        <Link className="action-button-secondary" to="/profile">
          Profile
        </Link>
      </Panel>
    </div>
  );
}

function AdminDashboard({ user }: { user: UserProfile | null }) {
  const queryClient = useQueryClient();
  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: dashboardApi.summary,
  });
  const urgentNeedsQuery = useQuery({
    queryKey: ["dashboard-urgent-needs"],
    queryFn: dashboardApi.urgentNeeds,
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
    urgentNeedsQuery.isLoading &&
    volunteerAvailabilityQuery.isLoading &&
    pipelineHealthQuery.isLoading;

  if (isInitialLoading) {
    return <LoaderBlock label="Loading dashboard..." />;
  }

  const summary = summaryQuery.data ?? {
    activeNeeds: 0,
    availableVolunteers: 0,
    pendingReviews: 0,
    submittedSurveys: 0,
  };
  const urgentNeeds = urgentNeedsQuery.data ?? [];
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
    <div className="space-y-4">
      <PageHeader
        eyebrow="Overview"
        title="Command Dashboard"
        description="Live NIYOJAN metrics from the current backend."
      />

      {summaryQuery.isError ? (
        <InlineError
          message={getApiErrorMessage(summaryQuery.error)}
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active needs" value={formatNumber(summary.activeNeeds)} />
        <MetricCard label="Available volunteers" value={formatNumber(summary.availableVolunteers)} />
        <MetricCard label="Pending reviews" value={formatNumber(summary.pendingReviews)} />
        <MetricCard label="Submitted surveys" value={formatNumber(summary.submittedSurveys)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_0.85fr]">
        <Panel className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
            <div>
              <p className="text-lg font-black text-white">Urgent needs</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Critical resource allocation requiring immediate review.
              </p>
            </div>
          </div>

          {urgentNeedsQuery.isError ? (
            <div className="p-3">
              <InlineError
                message={getApiErrorMessage(urgentNeedsQuery.error)}
                onRetry={() => void urgentNeedsQuery.refetch()}
              />
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-surface-container-low text-on-surface-variant">
                <tr>
                  <th className="px-4 py-2">Need</th>
                  <th className="px-4 py-2">Location</th>
                  <th className="px-4 py-2">Priority</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {urgentNeeds.map((need) => (
                  <tr
                    className="border-t border-outline-variant/70 hover:bg-surface-container-low"
                    key={need.id}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{need.summary}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
                        {need.category}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {need.locationText ?? "Unspecified"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={toneForStatus(need.priorityLevel)}>
                        {need.priorityLevel}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={toneForStatus(need.status)}>{need.status}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {formatDateTime(need.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-4">
        <Panel className="space-y-3">
            <div>
              <p className="text-lg font-black text-white">Pipeline health</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Queue depth and recent failures from background job orchestration.
              </p>
            </div>

            {pipelineHealthQuery.isError ? (
              <InlineError
                message={getApiErrorMessage(pipelineHealthQuery.error)}
                onRetry={() => void pipelineHealthQuery.refetch()}
              />
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-outline-variant bg-surface-container-low p-3">
                <p className="label-caps">Queue depth</p>
                <p className="mt-1 text-2xl font-black text-white">
                  {formatNumber(pipelineHealth.queueDepth)}
                </p>
              </div>
              <div className="rounded-md border border-outline-variant bg-surface-container-low p-3">
                <p className="label-caps">Processing documents</p>
                <p className="mt-1 text-2xl font-black text-white">
                  {formatNumber(pipelineHealth.processingDocuments)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {pipelineHealth.jobStatusBreakdown.map((item) => (
                <div className="flex items-center justify-between gap-3" key={item.status}>
                  <span className="text-sm text-on-surface-variant">{item.status}</span>
                  <span className="font-bold text-white">{formatNumber(item.count)}</span>
                </div>
              ))}
            </div>

            {pipelineHealth.recentFailures.length > 0 ? (
              <div className="space-y-2 rounded-md border border-danger/40 bg-danger/10 p-3">
                <p className="label-caps text-danger">Recent failures</p>
                {pipelineHealth.recentFailures.map((failure) => (
                  <div key={failure.id}>
                    <p className="text-sm font-semibold text-white">{failure.type}</p>
                    <p className="text-xs text-on-surface-variant">
                      {failure.entityType}:{failure.entityId} - {formatDateTime(failure.updatedAt)}
                    </p>
                    <p className="mt-1 text-xs text-danger">
                      {failure.errorMessage ?? "Unknown job failure"}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </Panel>

          <Panel className="space-y-3">
            <div>
              <p className="text-lg font-black text-white">Volunteer availability</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Live active volunteer breakdown across availability states.
              </p>
            </div>

            {volunteerAvailabilityQuery.isError ? (
              <InlineError
                message={getApiErrorMessage(volunteerAvailabilityQuery.error)}
                onRetry={() => void volunteerAvailabilityQuery.refetch()}
              />
            ) : null}

            <div className="rounded-md border border-outline-variant bg-surface-container-low p-3">
              <p className="label-caps">Total active volunteers</p>
              <p className="mt-1 text-2xl font-black text-white">
                {formatNumber(volunteerAvailability.totalActiveVolunteers)}
              </p>
            </div>
            <div className="space-y-2">
              {volunteerAvailability.breakdown.map((item) => (
                <div className="flex items-center justify-between" key={item.availabilityStatus}>
                  <span className="text-sm text-on-surface-variant">{item.availabilityStatus}</span>
                  <span className="font-bold text-white">{item.count}</span>
                </div>
              ))}
            </div>
          </Panel>

          {user?.role === "superadmin" ? (
            <Panel className="space-y-3">
              <div>
                <p className="text-lg font-black text-white">Pending NGO onboarding</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Resolve any organizations that were explicitly marked pending.
                </p>
              </div>

              {pendingNgosQuery.isError ? (
                <InlineError
                  message={getApiErrorMessage(pendingNgosQuery.error)}
                  onRetry={() => void pendingNgosQuery.refetch()}
                />
              ) : null}

              <div className="space-y-3">
                {(pendingNgosQuery.data ?? []).map((organization) => (
                  <div
                    className="rounded-md border border-outline-variant bg-surface-container-low p-3"
                    key={organization.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{organization.name}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          {organization.region ?? "Region pending"} ·{" "}
                          {organization.primaryAdmin?.email ?? "No primary admin"}
                        </p>
                      </div>
                      <StatusBadge tone="warning">{organization.status}</StatusBadge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        disabled={approveMutation.isPending}
                        onClick={() => void approveMutation.mutate(organization.id)}
                      >
                        Approve
                      </Button>
                      <Button
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
                  <p className="text-sm text-on-surface-variant">
                    No pending NGO registrations.
                  </p>
                ) : null}
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
