import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Archive, ArchiveRestore, CalendarDays, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states';
import { ASSESSMENT_CATEGORIES, ASSESSMENT_STATUSES } from '@exampilot/shared';
import { useAuth } from '@/hooks/use-auth';
import { ACCENT_OPTIONS, accentStyle } from '@/lib/domain';
import { formatDate, formatDaysRemaining, toDateInputValue, fromZonedInputValue } from '@/lib/format';
import {
  useAssessments,
  useCreateAssessment,
  useDeleteAssessment,
  useUpdateAssessment,
} from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { Assessment } from '@/lib/types';

/** Sends the user to the assessment list, which is the app's home. */
export const AssessmentDetailRedirect = () => <AssessmentsPage />;

interface FormState {
  name: string;
  category: string;
  description: string;
  startDate: string;
  examDate: string;
  timeZone: string;
  status: string;
  accentColor: string;
}

const emptyForm = (timeZone: string): FormState => ({
  name: '',
  category: '',
  description: '',
  startDate: '',
  examDate: '',
  timeZone,
  status: 'PLANNING',
  accentColor: ACCENT_OPTIONS[0].value,
});

export const AssessmentsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Assessment | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm(user?.timeZone ?? 'UTC'));
  const [deleting, setDeleting] = useState<Assessment | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const assessmentsQuery = useAssessments({ includeArchived: String(showArchived), search: search || undefined });
  const createMutation = useCreateAssessment();
  const updateMutation = useUpdateAssessment(editing?.id ?? '');
  const deleteMutation = useDeleteAssessment();

  // The sidebar's "New assessment" link arrives as ?new=1.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditing(null);
      setForm(emptyForm(user?.timeZone ?? 'UTC'));
      setFormOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, user?.timeZone]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(user?.timeZone ?? 'UTC'));
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (assessment: Assessment) => {
    setEditing(assessment);
    setForm({
      name: assessment.name,
      category: assessment.category ?? '',
      description: assessment.description ?? '',
      startDate: toDateInputValue(assessment.startDate, assessment.timeZone),
      examDate: toDateInputValue(assessment.examDate, assessment.timeZone),
      timeZone: assessment.timeZone,
      status: assessment.status,
      accentColor: assessment.accentColor ?? ACCENT_OPTIONS[0].value,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    // Dates are interpreted in the assessment's own time zone, not the browser's.
    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      startDate: fromZonedInputValue(form.startDate, form.timeZone),
      examDate: fromZonedInputValue(form.examDate, form.timeZone),
      timeZone: form.timeZone,
      status: form.status,
      accentColor: form.accentColor,
    };

    if (!payload.name) {
      setFormError('Give the assessment a name.');
      return;
    }
    if (payload.startDate && payload.examDate && new Date(payload.startDate) > new Date(payload.examDate)) {
      setFormError('The start date must be on or before the exam date.');
      return;
    }

    try {
      if (editing) {
        await updateMutation.mutateAsync(payload);
      } else {
        const created = await createMutation.mutateAsync(payload);
        navigate(`/assessments/${created.id}/dashboard`);
      }
      setFormOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save the assessment.');
    }
  };

  const toggleArchive = async (assessment: Assessment) => {
    await updateMutation.mutateAsync({ archived: !assessment.archivedAt });
  };

  const assessments = assessmentsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Assessments</h2>
          <p className="text-sm text-muted-foreground">
            Each assessment is its own workspace: syllabus, trackers, notes and results.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowArchived((value) => !value)}>
            {showArchived ? 'Hide archived' : 'Show archived'}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            New assessment
          </Button>
        </div>
      </div>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by name, category or description"
        aria-label="Search assessments"
        className="max-w-sm"
      />

      {assessmentsQuery.isLoading && <ListSkeleton rows={4} />}

      {assessmentsQuery.error && (
        <ErrorState
          title="Could not load your assessments"
          error={assessmentsQuery.error}
          onRetry={() => void assessmentsQuery.refetch()}
        />
      )}

      {!assessmentsQuery.isLoading && !assessmentsQuery.error && assessments.length === 0 && (
        <EmptyState
          title={search ? 'No assessments match that search' : 'No assessments yet'}
          description={
            search
              ? 'Try a different name or clear the search.'
              : 'Create your first assessment to start planning. You can start from an empty workspace or import an optional syllabus template.'
          }
          icon={<CalendarDays className="size-5" />}
          action={
            !search ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Create an assessment
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="grid gap-3">
        {assessments.map((assessment) => (
          <Card
            key={assessment.id}
            style={accentStyle(assessment.accentColor)}
            className={cn('transition-colors', assessment.archivedAt && 'opacity-60')}
          >
            <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: assessment.accentColor ?? '#94a3b8' }}
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    className="truncate text-sm font-medium hover:underline"
                    onClick={() => navigate(`/assessments/${assessment.id}/dashboard`)}
                  >
                    {assessment.name}
                  </button>
                  <Badge variant="muted">{assessment.status.toLowerCase()}</Badge>
                  {assessment.archivedAt && <Badge variant="muted">archived</Badge>}
                </div>

                <p className="text-sm text-muted-foreground">
                  {assessment.examDate
                    ? `${formatDaysRemaining(assessment.daysUntilExam)} · exam on ${formatDate(assessment.examDate, assessment.timeZone)}`
                    : 'No exam date set'}
                  {' · '}
                  <span title={`Times shown in ${assessment.timeZone}`}>{assessment.timeZone}</span>
                </p>

                {assessment.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{assessment.description}</p>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/assessments/${assessment.id}/dashboard`)}
                >
                  Open
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${assessment.name}`}>
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => openEdit(assessment)} className="cursor-pointer">
                      <Pencil className="size-4" />
                      Edit details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => void toggleArchive(assessment)}
                      className="cursor-pointer"
                    >
                      {assessment.archivedAt ? (
                        <>
                          <ArchiveRestore className="size-4" />
                          Restore
                        </>
                      ) : (
                        <>
                          <Archive className="size-4" />
                          Archive
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => setDeleting(assessment)} className="cursor-pointer">
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create / edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit assessment' : 'New assessment'}</DialogTitle>
            <DialogDescription>
              Only the name is required. An exam date is optional — plans without one are supported.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="assessment-name">Name</Label>
              <Input
                id="assessment-name"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="e.g. GATE CS 2027"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="assessment-category">Category</Label>
                <Input
                  id="assessment-category"
                  list="assessment-categories"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  placeholder="Competitive exam"
                />
                <datalist id="assessment-categories">
                  {ASSESSMENT_CATEGORIES.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assessment-status">Status</Label>
                <NativeSelect
                  id="assessment-status"
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                >
                  {ASSESSMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0) + status.slice(1).toLowerCase()}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="assessment-start">Start date</Label>
                <Input
                  id="assessment-start"
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="assessment-exam">Exam date</Label>
                <Input
                  id="assessment-exam"
                  type="date"
                  value={form.examDate}
                  onChange={(event) => setForm({ ...form, examDate: event.target.value })}
                />
                <p className="text-xs text-muted-foreground">Leave empty if the date is not fixed yet.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="assessment-timezone">Time zone</Label>
              <Input
                id="assessment-timezone"
                value={form.timeZone}
                onChange={(event) => setForm({ ...form, timeZone: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Countdowns, due-date statuses and reminders for this assessment use this zone.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="assessment-description">Description</Label>
              <Textarea
                id="assessment-description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Optional notes about this exam"
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Accent colour</legend>
              <div className="flex flex-wrap gap-2">
                {ACCENT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setForm({ ...form, accentColor: option.value })}
                    aria-label={option.label}
                    aria-pressed={form.accentColor === option.value}
                    className={cn(
                      'size-7 rounded-full ring-offset-2 ring-offset-background transition',
                      option.swatch,
                      form.accentColor === option.value && 'ring-2 ring-ring',
                    )}
                  />
                ))}
              </div>
            </fieldset>

            {formError && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving…'
                  : editing
                    ? 'Save changes'
                    : 'Create assessment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.name ?? ''}"?`}
        description="This permanently removes the assessment and everything in it: syllabus, trackers, study items, sessions, bookmarks, notes, mock tests and reminders. Archiving keeps the data and hides it from the list instead."
        confirmLabel="Delete permanently"
        onConfirm={async () => {
          if (deleting) await deleteMutation.mutateAsync(deleting.id);
        }}
      />
    </div>
  );
};
