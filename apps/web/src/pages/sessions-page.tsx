import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Clock, Plus, Timer, Trash2 } from 'lucide-react';
import { AssessmentGate } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states';
import { formatDate, formatDateTime, formatMinutes, formatTime, fromZonedInputValue, toDateTimeLocalValue } from '@/lib/format';
import { useStudyItems, useStudySessionMutations, useStudySessions } from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { Assessment, StudySession } from '@/lib/types';

export const SessionsPage = () => (
  <AssessmentGate title="study sessions">
    {(assessment) => <SessionsContent assessment={assessment} />}
  </AssessmentGate>
);

type Mode = 'range' | 'manual';

const LogSessionForm = ({
  assessment,
  items,
}: {
  assessment: Assessment;
  items: Array<{ id: string; name: string }>;
}) => {
  const { create } = useStudySessionMutations(assessment.id);
  const tz = assessment.timeZone;
  const nowIso = new Date().toISOString();
  const [mode, setMode] = useState<Mode>('manual');
  const [itemId, setItemId] = useState('');
  const [start, setStart] = useState(toDateTimeLocalValue(new Date(Date.now() - 3600_000).toISOString(), tz));
  const [end, setEnd] = useState(toDateTimeLocalValue(nowIso, tz));
  const [minutes, setMinutes] = useState('');
  const [notes, setNotes] = useState('');

  const startIso = fromZonedInputValue(start, tz);
  const endIso = fromZonedInputValue(end, tz);
  const rangeMinutes = startIso && endIso ? Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000) : null;

  let problem: string | null = null;
  if (mode === 'range') {
    if (!startIso || !endIso) problem = 'Enter a start and an end time.';
    else if (rangeMinutes === null || rangeMinutes <= 0) problem = 'The end must be after the start.';
  } else if (!/^\d+$/.test(minutes) || Number(minutes) < 1 || Number(minutes) > 10080) {
    problem = 'Enter whole minutes between 1 and 10080.';
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Log a session</CardTitle>
        <CardDescription>
          Each session is counted once. Use a start and end time, or just the minutes, never both.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (problem) return;
            try {
              await create.mutateAsync({
                studyItemId: itemId || null,
                ...(mode === 'range' ? { startedAt: startIso, endedAt: endIso } : { manualMinutes: Number(minutes) }),
                notes: notes.trim() || null,
              });
              toast.success('Session logged');
              setMinutes('');
              setNotes('');
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Could not log the session');
            }
          }}
        >
          <div role="group" aria-label="How to enter the time" className="inline-flex w-fit rounded-md border border-border p-0.5">
            {(
              [
                ['manual', 'Minutes'],
                ['range', 'Start and end'],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={mode === value ? 'secondary' : 'ghost'}
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {mode === 'manual' ? (
              <div>
                <Label htmlFor="ss-min">Minutes studied</Label>
                <Input id="ss-min" inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} placeholder="e.g. 45" />
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="ss-start">Started</Label>
                  <Input id="ss-start" type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="ss-end">Ended</Label>
                  <Input id="ss-end" type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} />
                </div>
              </>
            )}
            <div>
              <Label htmlFor="ss-item">Study item (optional)</Label>
              <NativeSelect id="ss-item" value={itemId} onChange={(event) => setItemId(event.target.value)}>
                <option value="">General study</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          {mode === 'range' && rangeMinutes !== null && rangeMinutes > 0 && (
            <p className="text-xs text-muted-foreground">{`That is ${formatMinutes(rangeMinutes)}. Times are in ${tz}.`}</p>
          )}
          {minutes && problem && mode === 'manual' && (
            <p role="alert" className="text-xs text-destructive">
              {problem}
            </p>
          )}
          {mode === 'range' && problem && (
            <p role="alert" className="text-xs text-destructive">
              {problem}
            </p>
          )}

          <div>
            <Label htmlFor="ss-notes">Notes (optional)</Label>
            <Textarea id="ss-notes" rows={2} value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} />
          </div>

          <div>
            <Button type="submit" disabled={Boolean(problem) || create.isPending}>
              <Plus /> Log session
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const SessionsContent = ({ assessment }: { assessment: Assessment }) => {
  const tz = assessment.timeZone;
  const [itemId, setItemId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<StudySession | null>(null);

  const itemsQuery = useStudyItems(assessment.id, { pageSize: 100, sort: 'NAME' });
  const items = useMemo(() => itemsQuery.data?.items ?? [], [itemsQuery.data]);
  const itemNames = useMemo(() => new Map(items.map((item) => [item.id, item.name] as const)), [items]);

  const sessions = useStudySessions(assessment.id, {
    page,
    pageSize: 25,
    studyItemId: itemId || undefined,
    from: from ? fromZonedInputValue(`${from}T00:00`, tz) : undefined,
    // Include the whole "to" day.
    to: to ? fromZonedInputValue(`${to}T23:59`, tz) : undefined,
  });
  const { remove } = useStudySessionMutations(assessment.id);

  const rows = sessions.data?.items ?? [];
  const total = sessions.data?.total ?? 0;
  const pageSize = sessions.data?.pageSize ?? 25;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const filtered = Boolean(itemId || from || to);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Study sessions</h1>
        <p className="text-sm text-muted-foreground">
          Your actual study time. It is what the dashboard compares against your estimates.
        </p>
      </header>

      <LogSessionForm assessment={assessment} items={items} />

      <section className="space-y-3" aria-label="Logged sessions">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="sf-item" className="text-xs">Item</Label>
            <NativeSelect id="sf-item" className="w-auto" value={itemId} onChange={(event) => { setItemId(event.target.value); setPage(1); }}>
              <option value="">All sessions</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="sf-from" className="text-xs">From</Label>
            <Input id="sf-from" type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
          </div>
          <div>
            <Label htmlFor="sf-to" className="text-xs">To</Label>
            <Input id="sf-to" type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
          </div>
          {filtered && (
            <Button variant="ghost" size="sm" onClick={() => { setItemId(''); setFrom(''); setTo(''); setPage(1); }}>
              Clear
            </Button>
          )}
          <p className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
            <Timer className="size-4" />
            {sessions.data ? `${formatMinutes(sessions.data.totalMinutes)} ${filtered ? 'in this filter' : 'in total'}` : '…'}
          </p>
        </div>

        {sessions.isLoading ? (
          <ListSkeleton rows={4} />
        ) : sessions.error ? (
          <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Clock className="size-5" />}
            title={filtered ? 'No sessions match these filters' : 'No sessions logged yet'}
            description={filtered ? undefined : 'Log a session above. Nothing is tracked until you add it.'}
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {rows.map((session) => {
              const manual = session.manualMinutes !== null;
              const name = session.studyItemId ? itemNames.get(session.studyItemId) ?? 'Linked item' : 'General study';
              return (
                <li key={session.id} className="flex items-start gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {formatMinutes(session.effectiveMinutes)}
                      <span className="font-normal text-muted-foreground">{` · ${name}`}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {manual
                        ? `Entered as minutes · ${formatDate(session.startedAt, tz)}`
                        : `${formatDateTime(session.startedAt, tz)} to ${session.endedAt ? formatTime(session.endedAt, tz) : '…'}`}
                    </p>
                    {session.notes && <p className={cn('mt-1 text-sm text-muted-foreground')}>{session.notes}</p>}
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label="Delete this session" onClick={() => setDeleting(session)}>
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {total > pageSize && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{`${total} sessions · page ${page} of ${totalPages}`}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this session?"
        description={`${deleting ? formatMinutes(deleting.effectiveMinutes) : ''} will be removed from your actual study time.`}
        confirmLabel="Delete session"
        onConfirm={async () => {
          if (deleting) {
            try {
              await remove.mutateAsync(deleting.id);
              toast.success('Session deleted');
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Could not delete the session');
            }
          }
          setDeleting(null);
        }}
      />
    </div>
  );
};
