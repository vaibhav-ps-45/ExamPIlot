import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Bookmark, Clock, Pencil, Plus, Trash2, Trophy } from 'lucide-react';
import { AssessmentGate } from '@/components/layout/app-shell';
import { MockTestDialog } from '@/components/mocks/mock-test-dialog';
import { TrendChart } from '@/components/mocks/trend-chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states';
import { formatDate, formatMinutes, formatPercent, fromZonedInputValue } from '@/lib/format';
import { useBookmarkMutations, useMockTestMutations, useMockTestSummary, useMockTests } from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { Assessment, MockTest } from '@/lib/types';

export const MockTestsPage = () => (
  <AssessmentGate title="mock tests">
    {(assessment) => <MockTestsContent assessment={assessment} />}
  </AssessmentGate>
);

const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <Card>
    <CardContent className="space-y-0.5 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
    </CardContent>
  </Card>
);

const TestCard = ({
  test,
  timeZone,
  highlighted,
  onEdit,
  onDelete,
}: {
  test: MockTest;
  timeZone: string;
  highlighted: boolean;
  onEdit: (test: MockTest) => void;
  onDelete: (test: MockTest) => void;
}) => {
  const ref = useRef<HTMLLIElement>(null);
  const { update } = useMockTestMutations(test.assessmentId);
  const bookmarks = useBookmarkMutations();

  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlighted]);

  const run = async (work: () => Promise<unknown>, failure: string) => {
    try {
      await work();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : failure);
    }
  };

  return (
    <li ref={ref} className={cn('rounded-lg border border-border bg-card p-4', highlighted && 'ring-2 ring-primary/60')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{test.name}</h3>
          <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            <span>{formatDate(test.takenOn, timeZone)}</span>
            {test.durationMinutes !== null && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" /> {formatMinutes(test.durationMinutes)}
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">{`${test.marksObtained} / ${test.totalMarks}`}</p>
          <p className="text-xs text-muted-foreground">{formatPercent(test.percentage, 1)}</p>
        </div>
      </div>

      {test.sections && test.sections.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {test.sections.map((section) => (
            <li key={section.name}>
              <Badge variant="outline">{`${section.name}: ${section.marksObtained}/${section.totalMarks}`}</Badge>
            </li>
          ))}
        </ul>
      )}
      {test.notes && <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{test.notes}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={test.reviewed}
            disabled={update.isPending}
            onCheckedChange={(checked) =>
              void run(() => update.mutateAsync({ id: test.id, reviewed: checked === true }), 'Could not update')
            }
          />
          Mistakes reviewed
        </label>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-pressed={test.isBookmarked}
            aria-label={test.isBookmarked ? `Remove ${test.name} from Saved for Later` : `Save ${test.name} for later`}
            onClick={() =>
              void run(
                () =>
                  test.bookmarkId
                    ? bookmarks.remove.mutateAsync(test.bookmarkId)
                    : bookmarks.create.mutateAsync({ targetType: 'MOCK_TEST', mockTestId: test.id, label: 'REVISE' }),
                'Could not update the bookmark',
              )
            }
          >
            <Bookmark className={cn('size-4', test.isBookmarked && 'fill-primary text-primary')} />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${test.name}`} onClick={() => onEdit(test)}>
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Delete ${test.name}`} onClick={() => onDelete(test)}>
            <Trash2 />
          </Button>
        </div>
      </div>
    </li>
  );
};

const MockTestsContent = ({ assessment }: { assessment: Assessment }) => {
  const tz = assessment.timeZone;
  const [params] = useSearchParams();
  const highlightId = params.get('test');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ open: boolean; test: MockTest | null }>({ open: false, test: null });
  const [deleting, setDeleting] = useState<MockTest | null>(null);

  const summary = useMockTestSummary(assessment.id);
  const tests = useMockTests(assessment.id, {
    page,
    pageSize: 25,
    from: from ? fromZonedInputValue(`${from}T00:00`, tz) : undefined,
    to: to ? fromZonedInputValue(`${to}T23:59`, tz) : undefined,
  });
  const { remove } = useMockTestMutations(assessment.id);

  const rows = tests.data?.items ?? [];
  const total = tests.data?.total ?? 0;
  const pageSize = tests.data?.pageSize ?? 25;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const filtered = Boolean(from || to);
  const stats = summary.data;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mock tests</h1>
          <p className="text-sm text-muted-foreground">
            Record the results of tests you took elsewhere. ExamPilot does not run exams; it keeps your scores and works out the trend.
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true, test: null })}>
          <Plus /> Record result
        </Button>
      </header>

      {stats && stats.count > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Tests recorded" value={String(stats.count)} />
            <Stat label="Average" value={formatPercent(stats.averagePercentage, 1)} hint="Mean of each test's percentage" />
            <Stat label="Best" value={formatPercent(stats.bestPercentage, 1)} />
            <Stat label="Latest" value={formatPercent(stats.latestPercentage, 1)} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Score trend</CardTitle>
              <CardDescription>{stats.trend.length < stats.count ? `The most recent ${stats.trend.length} tests.` : 'All recorded tests.'}</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart trend={stats.trend} timeZone={tz} />
            </CardContent>
          </Card>
        </>
      )}

      <section className="space-y-3" aria-label="Recorded tests">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="mf-from" className="text-xs">From</Label>
            <Input id="mf-from" type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
          </div>
          <div>
            <Label htmlFor="mf-to" className="text-xs">To</Label>
            <Input id="mf-to" type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
          </div>
          {filtered && (
            <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo(''); setPage(1); }}>
              Clear
            </Button>
          )}
        </div>

        {tests.isLoading ? (
          <ListSkeleton rows={3} />
        ) : tests.error ? (
          <ErrorState error={tests.error} onRetry={() => void tests.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Trophy className="size-5" />}
            title={filtered ? 'No tests in this date range' : 'No mock tests recorded yet'}
            description={filtered ? undefined : 'Record a result after you take a test. Nothing is estimated or filled in for you.'}
            action={!filtered ? <Button onClick={() => setDialog({ open: true, test: null })}><Plus /> Record your first result</Button> : undefined}
          />
        ) : (
          <ul className="space-y-3">
            {rows.map((test) => (
              <TestCard key={test.id} test={test} timeZone={tz} highlighted={highlightId === test.id} onEdit={(entry) => setDialog({ open: true, test: entry })} onDelete={setDeleting} />
            ))}
          </ul>
        )}

        {total > pageSize && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{`${total} tests · page ${page} of ${totalPages}`}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        )}
      </section>

      <MockTestDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        assessmentId={assessment.id}
        timeZone={tz}
        test={dialog.test}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.name ?? ''}"?`}
        description="This result is removed from your history, and from the average and trend."
        confirmLabel="Delete result"
        onConfirm={async () => {
          if (deleting) {
            try {
              await remove.mutateAsync(deleting.id);
              toast.success('Result deleted');
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Could not delete the result');
            }
          }
          setDeleting(null);
        }}
      />
    </div>
  );
};
