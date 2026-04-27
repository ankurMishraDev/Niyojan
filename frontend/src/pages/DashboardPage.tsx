import { useQuery } from "@tanstack/react-query";
import { LoaderBlock, MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { dashboardApi } from "@/lib/services";
import { formatDateTime, formatNumber, toneForStatus } from "@/lib/format";

export function DashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [summary, urgentNeeds, volunteerAvailability, pipelineHealth] = await Promise.all([
        dashboardApi.summary(),
        dashboardApi.urgentNeeds(),
        dashboardApi.volunteerAvailability(),
        dashboardApi.pipelineHealth(),
      ]);

      return { summary, urgentNeeds, volunteerAvailability, pipelineHealth };
    },
  });

  if (dashboardQuery.isLoading) {
    return <LoaderBlock label="Loading dashboard..." />;
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return <LoaderBlock label="Dashboard data could not be loaded." />;
  }

  const { summary, urgentNeeds, volunteerAvailability, pipelineHealth } = dashboardQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Command Dashboard"
        description="Live metrics from the current backend, aligned to the FieldOps Command design but fed by real NGO operational data."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active needs" value={formatNumber(summary.activeNeeds)} />
        <MetricCard label="Available volunteers" value={formatNumber(summary.availableVolunteers)} />
        <MetricCard label="Pending reviews" value={formatNumber(summary.pendingReviews)} />
        <MetricCard label="Submitted surveys" value={formatNumber(summary.submittedSurveys)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <Panel className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
            <div>
              <p className="text-xl font-black text-white">Urgent needs</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Critical resource allocation requiring immediate review.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-container-low text-on-surface-variant">
                <tr>
                  <th className="px-5 py-3">Need</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {urgentNeeds.map((need) => (
                  <tr
                    className="border-t border-outline-variant/70 hover:bg-surface-container-low"
                    key={need.id}
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-white">{need.summary}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-on-surface-variant">
                        {need.category}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-on-surface-variant">
                      {need.locationText ?? "Unspecified"}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge tone={toneForStatus(need.priorityLevel)}>
                        {need.priorityLevel}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge tone={toneForStatus(need.status)}>{need.status}</StatusBadge>
                    </td>
                    <td className="px-5 py-4 text-on-surface-variant">
                      {formatDateTime(need.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel className="space-y-4">
            <div>
              <p className="text-xl font-black text-white">Pipeline health</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Queue depth and recent failures from background job orchestration.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-outline-variant bg-surface-container-low p-4">
                <p className="label-caps">Queue depth</p>
                <p className="mt-2 text-3xl font-black text-white">
                  {formatNumber(pipelineHealth.queueDepth)}
                </p>
              </div>
              <div className="rounded-md border border-outline-variant bg-surface-container-low p-4">
                <p className="label-caps">Processing documents</p>
                <p className="mt-2 text-3xl font-black text-white">
                  {formatNumber(pipelineHealth.processingDocuments)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {pipelineHealth.jobStatusBreakdown.map((item) => (
                <div className="flex items-center justify-between gap-3" key={item.status}>
                  <span className="text-sm text-on-surface-variant">{item.status}</span>
                  <span className="font-bold text-white">{formatNumber(item.count)}</span>
                </div>
              ))}
            </div>

            {pipelineHealth.recentFailures.length > 0 ? (
              <div className="space-y-2 rounded-md border border-danger/40 bg-danger/10 p-4">
                <p className="label-caps text-danger">Recent failures</p>
                {pipelineHealth.recentFailures.map((failure) => (
                  <div key={failure.id}>
                    <p className="text-sm font-semibold text-white">{failure.type}</p>
                    <p className="text-xs text-on-surface-variant">
                      {failure.entityType}:{failure.entityId} · {formatDateTime(failure.updatedAt)}
                    </p>
                    <p className="mt-1 text-xs text-danger">
                      {failure.errorMessage ?? "Unknown job failure"}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </Panel>

          <Panel className="space-y-4">
            <div>
              <p className="text-xl font-black text-white">Volunteer availability</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Live active volunteer breakdown across availability states.
              </p>
            </div>
            <div className="rounded-md border border-outline-variant bg-surface-container-low p-4">
              <p className="label-caps">Total active volunteers</p>
              <p className="mt-2 text-3xl font-black text-white">
                {formatNumber(volunteerAvailability.totalActiveVolunteers)}
              </p>
            </div>
            <div className="space-y-3">
              {volunteerAvailability.breakdown.map((item) => (
                <div className="flex items-center justify-between" key={item.availabilityStatus}>
                  <span className="text-sm text-on-surface-variant">{item.availabilityStatus}</span>
                  <span className="font-bold text-white">{item.count}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
