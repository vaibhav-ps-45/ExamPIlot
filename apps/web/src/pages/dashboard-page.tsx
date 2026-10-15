import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Bookmark,
  CalendarClock,
  CheckCircle2,
  Clock,
  Layers,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AssessmentGate } from '@/components/layout/app-shell';
import { CardSkeleton, EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states';
import { DATE_STATUS_META } from '@/lib/domain';
import { dueLabel, formatDate, formatDateTime, formatDaysRemaining, formatMinutes, formatPercent } from '@/lib/format';
import { useAnalytics, useOverview, useReminders } from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { AssessmentAnalytics } from '@/lib/types';

/**
 * Metric definitions are surfaced in the UI rather than left implicit, so a
 * number on this page can always be explained. They match docs/API.md exactly.
 */
const METRIC_HELP = {
  completion: 'Completed items ÷ total items. Counts items, not minutes.',
  time: 'Actual time is the sum of your logged sessions, counted once each.',
  adherence: 'Items completed on or before their due date ÷ items completed with a due date.',
  slippage: 'Total days by which late items missed their original due date. Nothing is rescheduled automatically.',
  mock: 'Computed from the mock tests you recorded. No estimated or sample values.',
} as const;

const MetricCard = ({
  label,
  value,
  hint,
  icon,
  help,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  help: string;
  tone?: 'default' | 'warning' | 'success';
}) => (
  <Card>
    <CardContent className="space-y-1.5 p-4">
      <div className="flex items-center justify-between gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
          </TooltipTrigger>
          <TooltipContent>{help}</TooltipContent>
        </Tooltip>
        <span
          className={cn(
            'text-muted-foreground',
            tone === 'warning' && 'text-destructive',
            tone === 'success' && 'text-success',
          )}
        >
          {icon}
        </span>
      </div>
      <p
        className={cn(
          'text-2xl font-semibold tabular-nums',
          tone === 'warning' && 'text-destructive',
        )}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </CardContent>
  </Card>
);

const MiniBar = ({ value, className }: { value: number; className?: string }) => (
  <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}>
    <div
      className="h-full rounded-full bg-primary transition-all"
      style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    />
  </div>
);

const MockTrend = ({ trend }: { trend: AssessmentAnalytics['mockTests']['trend'] }) => {
  if (trend.length === 0) return null;
  const max = Math.max(...trend.map((point) => point.percentage), 100);

  return (
    <div className="flex h-28 items-end gap-1.5" role="img" aria-label="Mock test score trend">
      {trend.map((point) => (
        <Tooltip key={point.id}>
          <TooltipTrigger asChild>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-primary/80 transition-all hover:bg-primary"
                style={{ height: `${(point.percentage / max) * 80}px` }}
              />
              <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                {point.percentage.toFixed(0)}%
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {point.name} · {point.percentage.toFixed(1)}%
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
};

const AssessmentDashboard = () => (
  <AssessmentGate title="the dashboard">
    {(assessment) => <AssessmentDashboardContent assessmentId={assessment.id} timeZone={assessment.timeZone} />}
  </AssessmentGate>
);

const AssessmentDashboardContent = ({ assessmentId, timeZone }: { assessmentId: string; timeZone: string }) => {
  const analyticsQuery = useAnalytics(assessmentId);
  const remindersQuery = useReminders({ assessmentId, pageSize: 100 });

  const analytics = analyticsQuery.data;

  if (analyticsQuery.isLoading) {
    return (
      <div className="space-y-5">
        <CardSkeleton />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (analyticsQuery.error) {
    return (
      <ErrorState
        title="Could not load the dashboard"
        error={analyticsQuery.error}
        onRetry={() => void analyticsQuery.refetch()}
      />
    );
  }

  if (!analytics) return null;

  const hasNoData = analytics.totals.items === 0 && analytics.totals.syllabusNodes === 0;
  const reminders = remindersQuery.data?.items ?? [];

  if (hasNoData) {
    return (
      <EmptyState
        title="This workspace is empty"
        description="Add study items yourself, or import an optional syllabus template to get a starting outline. Importing never creates dates or reminders for you."
        icon={<Layers className="size-5" />}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to={`/assessments/${assessmentId}/trackers`}>Open trackers</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/assessments/${assessmentId}/syllabus`}>Import a syllabus</Link>
            </Button>
          </div>
        }
      />
    );
  }

  const { totals, time, schedule, mockTests, upcomingDeadlines, recentSessions, bookmarksByLabel } = analytics;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              {formatDaysRemaining(analytics.daysUntilExam)} · times in {timeZone}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Hover any metric label to see how it is calculated.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Completion"
            value={formatPercent(totals.completionPercentage)}
            hint={`${totals.completedItems} of ${totals.items} items complete`}
            icon={<CheckCircle2 className="size-4" />}
            help={METRIC_HELP.completion}
            tone={totals.completionPercentage >= 100 ? 'success' : 'default'}
          />
          <MetricCard
            label="Time logged"
            value={formatMinutes(time.actualMinutes)}
            hint={`${time.sessionCount} sessions · estimated ${formatMinutes(time.estimatedMinutes)}`}
            icon={<Clock className="size-4" />}
            help={METRIC_HELP.time}
          />
          <MetricCard
            label="Overdue"
            value={String(schedule.overdue)}
            hint={`${schedule.dueToday} due today · ${schedule.upcoming} upcoming`}
            icon={<AlertTriangle className="size-4" />}
            help="Items whose due date has passed and that are not complete. Their dates are left exactly as planned."
            tone={schedule.overdue > 0 ? 'warning' : 'default'}
          />
          <MetricCard
            label="Adherence"
            value={schedule.adherencePercentage === null ? '—' : formatPercent(schedule.adherencePercentage, 0)}
            hint={
              schedule.adherencePercentage === null
                ? 'No items completed with a due date yet'
                : `${schedule.completedOnTime} on time · ${schedule.completedLate} late`
            }
            icon={<TrendingUp className="size-4" />}
            help={METRIC_HELP.adherence}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Progress</CardTitle>
              <CardDescription>Planned versus actual, and what is left.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Items complete</span>
                  <span className="tabular-nums">
                    {totals.completedItems}/{totals.items}
                  </span>
                </div>
                <MiniBar value={totals.completionPercentage} />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">Estimated remaining</p>
                  <p className="text-sm font-medium">{formatMinutes(time.remainingEstimatedMinutes)}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">Actual / estimated</p>
                  <p className="text-sm font-medium">
                    {time.plannedVsActualRatio === null ? '—' : `${time.plannedVsActualRatio.toFixed(2)}×`}
                  </p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">Practice attempts</p>
                  <p className="text-sm font-medium">{totals.attemptsRecorded}</p>
                </div>
              </div>

              <Separator />

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="text-muted-foreground">
                  Subjects <span className="font-medium text-foreground">{totals.subjects}</span>
                </span>
                <span className="text-muted-foreground">
                  Syllabus nodes <span className="font-medium text-foreground">{totals.syllabusNodes}</span>
                </span>
                <span className="text-muted-foreground">
                  Notes <span className="font-medium text-foreground">{totals.notes}</span>
                </span>
                <span className="text-muted-foreground">
                  No due date <span className="font-medium text-foreground">{schedule.noDate}</span>
                </span>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="cursor-help text-xs text-muted-foreground">
                    Total slippage across late items: <strong>{schedule.totalSlippageDays} days</strong>.
                  </p>
                </TooltipTrigger>
                <TooltipContent>{METRIC_HELP.slippage}</TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mock tests</CardTitle>
              <CardDescription>
                {mockTests.count === 0 ? 'No tests recorded yet.' : `${mockTests.count} recorded`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockTests.count === 0 ? (
                <EmptyState
                  className="border-none py-6"
                  title="No mock results"
                  description="Record a test to see averages and a trend. Nothing is estimated for you."
                  action={
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/assessments/${assessmentId}/mock-tests`}>Record a mock test</Link>
                    </Button>
                  }
                />
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Average</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatPercent(mockTests.averagePercentage, 1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Best</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatPercent(mockTests.bestPercentage, 1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Latest</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatPercent(mockTests.latestPercentage, 1)}
                      </p>
                    </div>
                  </div>
                  <MockTrend trend={mockTests.trend} />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="cursor-help text-xs text-muted-foreground">{METRIC_HELP.mock}</p>
                    </TooltipTrigger>
                    <TooltipContent>{METRIC_HELP.mock}</TooltipContent>
                  </Tooltip>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Upcoming deadlines</CardTitle>
              <CardDescription>Nearest first. Overdue items keep their original dates.</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingDeadlines.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  Nothing scheduled with a due date yet.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {upcomingDeadlines.map((deadline) => (
                    <li key={deadline.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{deadline.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {deadline.subject ?? 'No subject'} · {formatDate(deadline.dueDate, timeZone)}
                        </p>
                      </div>
                      <Badge variant={deadline.isOverdue ? 'destructive' : 'outline'}>
                        {dueLabel(deadline.daysUntilDue)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Saved for revision</CardTitle>
                <CardDescription>{totals.bookmarkedItems} bookmarked items</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {bookmarksByLabel.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing bookmarked yet. Bookmark from any tracker layout.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {bookmarksByLabel.map((entry) => (
                      <li key={entry.label} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{entry.label.toLowerCase().replace(/_/g, ' ')}</span>
                        <span className="tabular-nums">{entry.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link to="/saved">
                    <Bookmark className="size-4" />
                    Open saved items
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reminders</CardTitle>
                <CardDescription>
                  {reminders.length === 0
                    ? 'None set — reminders are opt-in.'
                    : `${reminders.filter((r) => r.enabled).length} enabled`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {reminders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing here unless you create it. Setting a deadline never creates a reminder.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {reminders.slice(0, 3).map((reminder) => (
                      <li key={reminder.id} className="flex items-start justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">{reminder.title}</span>
                        {reminder.isMissed ? (
                          <Badge variant="destructive">missed</Badge>
                        ) : (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatDateTime(reminder.remindAt, reminder.timeZone)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link to="/reminders">
                    <CalendarClock className="size-4" />
                    Manage reminders
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent study sessions</CardTitle>
            <CardDescription>The last {recentSessions.length} logged sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentSessions.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">
                No sessions logged yet. Log one from a study item to build up actual time.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentSessions.map((session) => (
                  <li key={session.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{session.itemName ?? 'Unassigned session'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(session.startedAt, timeZone)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums">{formatMinutes(session.minutes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

/** Cross-assessment overview, shown when no single workspace is open. */
const GlobalOverview = () => {
  const overviewQuery = useOverview();
  const navigate = useNavigate();

  const data = overviewQuery.data;

  if (overviewQuery.isLoading) return <CardSkeleton />;
  if (overviewQuery.error) {
    return (
      <ErrorState
        title="Could not load your overview"
        error={overviewQuery.error}
        onRetry={() => void overviewQuery.refetch()}
      />
    );
  }
  if (!data || data.assessments.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">All assessments</h2>
        <p className="text-sm text-muted-foreground">A combined view across every active workspace.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Assessments"
          value={String(data.totals.assessments)}
          icon={<Layers className="size-4" />}
          help="Active, non-archived assessments."
        />
        <MetricCard
          label="Items complete"
          value={`${data.totals.completedItems}/${data.totals.items}`}
          icon={<CheckCircle2 className="size-4" />}
          help={METRIC_HELP.completion}
        />
        <MetricCard
          label="Time logged"
          value={formatMinutes(data.totals.actualMinutes)}
          icon={<Clock className="size-4" />}
          help={METRIC_HELP.time}
        />
        <MetricCard
          label="Overdue"
          value={String(data.totals.overdueItems)}
          icon={<AlertTriangle className="size-4" />}
          help="Across all assessments."
          tone={data.totals.overdueItems > 0 ? 'warning' : 'default'}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {data.assessments.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/assessments/${row.id}/dashboard`)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.accentColor ?? '#94a3b8' }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{row.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDaysRemaining(row.daysUntilExam)} · {row.completedItems}/{row.items} items
                    </span>
                  </span>
                  <span className="hidden w-32 sm:block">
                    <MiniBar value={row.completionPercentage} />
                  </span>
                  <span className="w-14 shrink-0 text-right text-sm tabular-nums">
                    {formatPercent(row.completionPercentage, 0)}
                  </span>
                  {row.overdueItems > 0 && <Badge variant="destructive">{row.overdueItems} overdue</Badge>}
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export const DashboardPage = () => {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  return assessmentId ? <AssessmentDashboard /> : <GlobalOverview />;
};

export { AssessmentDashboardContent };
export const DashboardStatusMeta = DATE_STATUS_META;
