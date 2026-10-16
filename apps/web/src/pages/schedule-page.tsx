import { useMemo, useState } from 'react';
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { AssessmentGate } from '@/components/layout/app-shell';
import { dayLabel, groupByDay, monthGrid, monthLabel, parseKey, shiftMonth } from '@/components/schedule/calendar-utils';
import { ItemDetailDialog } from '@/components/trackers/item-detail-dialog';
import { ItemFormDialog } from '@/components/trackers/item-form-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states';
import { dueLabel, formatDaysRemaining, formatPercent, fromZonedInputValue, toDateInputValue } from '@/lib/format';
import { useAnalytics, useCustomFields, useStudyItems, useTrackers } from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { Assessment, StudyItem } from '@/lib/types';

export const SchedulePage = () => (
  <AssessmentGate title="the schedule">
    {(assessment) => <ScheduleContent assessment={assessment} />}
  </AssessmentGate>
);

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const chipClass = (item: StudyItem) =>
  item.completed
    ? 'bg-success/15 text-success line-through'
    : item.isOverdue
      ? 'bg-destructive/15 text-destructive'
      : item.dateStatus === 'DUE_TODAY'
        ? 'bg-warning/15 text-warning'
        : 'bg-primary/10 text-primary';

const Stat = ({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'bad' | 'warn' }) => (
  <Card>
    <CardContent className="space-y-0.5 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('text-2xl font-semibold', tone === 'bad' && 'text-destructive', tone === 'warn' && 'text-warning')}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </CardContent>
  </Card>
);

const ScheduleContent = ({ assessment }: { assessment: Assessment }) => {
  const tz = assessment.timeZone;
  const todayKey = toDateInputValue(new Date().toISOString(), tz);
  const today = parseKey(todayKey);

  const [view, setView] = useState({ year: today.year, month0: today.month0 });
  const [selected, setSelected] = useState<string>(todayKey);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<StudyItem | null>(null);

  const grid = useMemo(() => monthGrid(view.year, view.month0), [view]);
  const rangeStart = fromZonedInputValue(`${grid[0]!.key}T00:00`, tz);
  const rangeEnd = fromZonedInputValue(`${grid[41]!.key}T23:59`, tz);

  const analytics = useAnalytics(assessment.id);
  const monthItems = useStudyItems(assessment.id, {
    dueAfter: rangeStart,
    dueBefore: rangeEnd,
    sort: 'DUE_DATE',
    pageSize: 100,
  });
  const trackers = useTrackers(assessment.id);
  const customFields = useCustomFields(assessment.id);

  const byDay = useMemo(
    () => groupByDay(monthItems.data?.items ?? [], (item) => (item.dueDate ? toDateInputValue(item.dueDate, tz) : null)),
    [monthItems.data, tz],
  );
  const examKey = assessment.examDate ? toDateInputValue(assessment.examDate, tz) : null;
  const selectedItems = byDay.get(selected) ?? [];
  const schedule = analytics.data?.schedule;
  const tracker = trackers.data?.find((entry) => entry.isDefault) ?? trackers.data?.[0];

  const go = (delta: number) => setView((current) => shiftMonth(current.year, current.month0, delta));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
        <p className="text-sm text-muted-foreground">
          {`Your own dates, shown as you set them. Overdue is a label; nothing here moves a date. Times are in ${tz}.`}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Exam"
          value={analytics.data ? formatDaysRemaining(analytics.data.daysUntilExam) : '…'}
          hint={examKey ? `On ${examKey}` : 'No exam date set'}
        />
        <Stat label="Overdue" value={schedule ? String(schedule.overdue) : '…'} tone={schedule && schedule.overdue > 0 ? 'bad' : undefined} hint="Past their original due date" />
        <Stat label="Due today" value={schedule ? String(schedule.dueToday) : '…'} tone={schedule && schedule.dueToday > 0 ? 'warn' : undefined} />
        <Stat
          label="On-time rate"
          value={schedule ? formatPercent(schedule.adherencePercentage, 0) : '…'}
          hint={schedule ? `${schedule.completedOnTime} on time, ${schedule.completedLate} late · ${schedule.totalSlippageDays} days of slippage` : undefined}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <section aria-label="Calendar" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{monthLabel(view.year, view.month0)}</h2>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => go(-1)}>
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setView({ year: today.year, month0: today.month0 });
                  setSelected(todayKey);
                }}
              >
                Today
              </Button>
              <Button variant="outline" size="icon" aria-label="Next month" onClick={() => go(1)}>
                <ChevronRight />
              </Button>
            </div>
          </div>

          {monthItems.error ? (
            <ErrorState error={monthItems.error} onRetry={() => void monthItems.refetch()} />
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[640px] overflow-hidden rounded-lg border border-border bg-card" role="grid" aria-label={monthLabel(view.year, view.month0)}>
                <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground" role="row">
                  {WEEKDAYS.map((day) => (
                    <div key={day} className="px-2 py-1.5" role="columnheader">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7" role="rowgroup">
                  {grid.map((cell) => {
                    const items = byDay.get(cell.key) ?? [];
                    const isToday = cell.key === todayKey;
                    const isSelected = cell.key === selected;
                    const isExam = cell.key === examKey;
                    return (
                      <button
                        key={cell.key}
                        type="button"
                        role="gridcell"
                        aria-selected={isSelected}
                        aria-label={`${dayLabel(cell.key)}${items.length ? `, ${items.length} due` : ''}${isExam ? ', exam day' : ''}`}
                        onClick={() => setSelected(cell.key)}
                        className={cn(
                          'flex min-h-[5.5rem] flex-col items-stretch gap-1 border-b border-r border-border p-1.5 text-left transition-colors hover:bg-accent/40',
                          !cell.inMonth && 'bg-muted/20 text-muted-foreground',
                          isSelected && 'bg-primary/5 ring-2 ring-inset ring-primary/50',
                        )}
                      >
                        <span className="flex items-center justify-between">
                          <span className={cn('inline-flex size-6 items-center justify-center rounded-full text-xs', isToday && 'bg-primary font-semibold text-primary-foreground')}>
                            {parseKey(cell.key).day}
                          </span>
                          {isExam && <Flag className="size-3.5 text-destructive" aria-hidden="true" />}
                        </span>
                        {items.slice(0, 2).map((item) => (
                          <span key={item.id} className={cn('truncate rounded px-1 py-0.5 text-[11px] leading-tight', chipClass(item))}>
                            {item.name}
                          </span>
                        ))}
                        {items.length > 2 && <span className="text-[11px] text-muted-foreground">{`+${items.length - 2} more`}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {(monthItems.data?.total ?? 0) > (monthItems.data?.items.length ?? 0) && (
            <p className="text-xs text-muted-foreground">Showing the first 100 items in this range.</p>
          )}
        </section>

        <aside aria-label="Selected day" className="space-y-3">
          <h2 className="text-lg font-semibold">{dayLabel(selected)}</h2>
          {selected === examKey && (
            <p className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm">
              <Flag className="size-4 text-destructive" /> Exam day
            </p>
          )}
          {monthItems.isLoading ? (
            <ListSkeleton rows={3} />
          ) : selectedItems.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-5" />}
              title="Nothing due"
              description="Items appear here on the day you set as their due date."
            />
          ) : (
            <ul className="space-y-2">
              {selectedItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setDetailId(item.id)}
                    className="w-full rounded-lg border border-border bg-card p-3 text-left hover:bg-accent/40"
                  >
                    <span className={cn('block text-sm font-medium', item.completed && 'text-muted-foreground line-through')}>{item.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {item.subject && <span>{item.subject}</span>}
                      {item.completed ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <CalendarCheck className="size-3" /> Completed
                        </span>
                      ) : (
                        <span className={cn(item.isOverdue && 'font-medium text-destructive')}>{dueLabel(item.daysUntilDue)}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">Open an item to reschedule it. Dates change only when you do it.</p>
        </aside>
      </div>

      <ItemDetailDialog
        assessmentId={assessment.id}
        itemId={detailId}
        timeZone={tz}
        attemptSlots={tracker?.viewConfig.attemptSlots ?? 4}
        onOpenChange={(open) => !open && setDetailId(null)}
        onEdit={(item) => {
          setDetailId(null);
          setEditing(item);
        }}
      />
      {tracker && (
        <ItemFormDialog
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
          assessmentId={assessment.id}
          timeZone={tz}
          item={editing}
          tracker={tracker}
          trackers={trackers.data ?? []}
          customFields={customFields.data ?? []}
        />
      )}
    </div>
  );
};
