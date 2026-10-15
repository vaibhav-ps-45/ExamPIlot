import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlarmClock, CalendarClock, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingState } from '@/components/ui/states';
import { ReminderFormDialog } from '@/components/reminders/reminder-form-dialog';
import { ApiError } from '@/lib/api';
import { fromZonedInputValue, formatDate, formatMinutes, toDateInputValue } from '@/lib/format';
import { useAssessments, useStudyItem, useStudyItemMutations } from '@/lib/queries';
import type { PracticeAttempt, StudyItem } from '@/lib/types';
import { PriorityBadge, StatusBadge } from './shared';

const numberField = (label: string, max = 100000) =>
  z.string().regex(/^\d*(\.\d+)?$/, `${label}: numbers only`).refine((v) => v === '' || Number(v) <= max, `${label} is too large`);

const attemptSchema = z
  .object({
    slotIndex: z.string(),
    date: z.string().min(1, 'Pick a date'),
    questionsAttempted: numberField('Questions'),
    questionsCorrect: numberField('Correct'),
    marksObtained: numberField('Marks'),
    maxMarks: numberField('Max marks'),
    durationMinutes: numberField('Minutes', 1440),
    notes: z.string().max(2000),
  })
  .refine((v) => v.questionsAttempted === '' || v.questionsCorrect === '' || Number(v.questionsCorrect) <= Number(v.questionsAttempted), {
    message: 'Correct answers cannot exceed questions attempted',
    path: ['questionsCorrect'],
  })
  .refine((v) => v.maxMarks === '' || v.marksObtained === '' || Number(v.marksObtained) <= Number(v.maxMarks), {
    message: 'Marks obtained cannot exceed max marks',
    path: ['marksObtained'],
  });
type AttemptValues = z.infer<typeof attemptSchema>;

const num = (value: string): number | null => (value === '' ? null : Number(value));

const AttemptForm = ({
  assessmentId,
  itemId,
  timeZone,
  slotIndex,
  onDone,
}: {
  assessmentId: string;
  itemId: string;
  timeZone: string;
  slotIndex: number;
  onDone: () => void;
}) => {
  const { createAttempt } = useStudyItemMutations(assessmentId, itemId);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AttemptValues>({
    resolver: zodResolver(attemptSchema),
    defaultValues: {
      slotIndex: String(slotIndex),
      date: toDateInputValue(new Date().toISOString(), timeZone),
      questionsAttempted: '',
      questionsCorrect: '',
      marksObtained: '',
      maxMarks: '',
      durationMinutes: '',
      notes: '',
    },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await createAttempt.mutateAsync({
        slotIndex,
        attemptedAt: fromZonedInputValue(values.date, timeZone),
        questionsAttempted: num(values.questionsAttempted),
        questionsCorrect: num(values.questionsCorrect),
        marksObtained: num(values.marksObtained),
        maxMarks: num(values.maxMarks),
        durationMinutes: num(values.durationMinutes),
        notes: values.notes.trim() || null,
      });
      toast.success(`Attempt ${slotIndex + 1} recorded`);
      onDone();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not record the attempt');
    }
  });

  const err = (key: keyof AttemptValues) =>
    errors[key]?.message ? (
      <p role="alert" className="mt-1 text-xs text-destructive">
        {errors[key]?.message as string}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md border border-border bg-muted/30 p-3" noValidate>
      <p className="text-sm font-medium">{`Attempt ${slotIndex + 1}`}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="att-date">Date</Label>
          <Input id="att-date" type="date" {...register('date')} />
          {err('date')}
        </div>
        <div>
          <Label htmlFor="att-q">Questions attempted</Label>
          <Input id="att-q" inputMode="numeric" {...register('questionsAttempted')} />
          {err('questionsAttempted')}
        </div>
        <div>
          <Label htmlFor="att-c">Correct</Label>
          <Input id="att-c" inputMode="numeric" {...register('questionsCorrect')} />
          {err('questionsCorrect')}
        </div>
        <div>
          <Label htmlFor="att-m">Marks obtained</Label>
          <Input id="att-m" inputMode="decimal" {...register('marksObtained')} />
          {err('marksObtained')}
        </div>
        <div>
          <Label htmlFor="att-mm">Max marks</Label>
          <Input id="att-mm" inputMode="decimal" {...register('maxMarks')} />
          {err('maxMarks')}
        </div>
        <div>
          <Label htmlFor="att-d">Minutes</Label>
          <Input id="att-d" inputMode="numeric" {...register('durationMinutes')} />
          {err('durationMinutes')}
        </div>
      </div>
      <div>
        <Label htmlFor="att-n">Notes</Label>
        <Textarea id="att-n" rows={2} {...register('notes')} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          Save attempt
        </Button>
      </div>
    </form>
  );
};

const RescheduleForm = ({
  assessmentId,
  item,
  timeZone,
  onDone,
}: {
  assessmentId: string;
  item: StudyItem;
  timeZone: string;
  onDone: () => void;
}) => {
  const { reschedule } = useStudyItemMutations(assessmentId);
  const [start, setStart] = useState(toDateInputValue(item.plannedStartDate, timeZone));
  const [due, setDue] = useState(toDateInputValue(item.dueDate, timeZone));
  const [reason, setReason] = useState('');
  const invalidRange = Boolean(start && due && start > due);

  return (
    <form
      className="grid gap-3 rounded-md border border-border bg-muted/30 p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (invalidRange || (!start && !due)) return;
        try {
          await reschedule.mutateAsync({
            id: item.id,
            plannedStartDate: fromZonedInputValue(start, timeZone),
            dueDate: fromZonedInputValue(due, timeZone),
            reason: reason.trim() || null,
          });
          toast.success('Dates changed. The previous dates were kept in the history.');
          onDone();
        } catch (error) {
          toast.error(error instanceof ApiError ? error.message : 'Could not reschedule');
        }
      }}
    >
      <p className="text-xs text-muted-foreground">
        This is the only way dates change. The old dates and your reason are recorded so you can review how accurate
        your planning was.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="rs-start">New planned start</Label>
          <Input id="rs-start" type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="rs-due">New due date</Label>
          <Input id="rs-due" type="date" value={due} onChange={(event) => setDue(event.target.value)} />
        </div>
      </div>
      {invalidRange && (
        <p role="alert" className="text-xs text-destructive">
          Planned start must be on or before the due date.
        </p>
      )}
      <div>
        <Label htmlFor="rs-reason">Reason (optional)</Label>
        <Input id="rs-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={invalidRange || (!start && !due) || reschedule.isPending}>
          Reschedule
        </Button>
      </div>
    </form>
  );
};

const AttemptRow = ({
  attempt,
  timeZone,
  onDelete,
}: {
  attempt: PracticeAttempt;
  timeZone: string;
  onDelete: () => void;
}) => (
  <li className="flex items-start justify-between gap-3 rounded-md border border-border p-3 text-sm">
    <div className="space-y-0.5">
      <p className="font-medium">
        {`Attempt ${attempt.slotIndex + 1}`} <span className="font-normal text-muted-foreground">{`· ${formatDate(attempt.attemptedAt, timeZone)}`}</span>
      </p>
      <p className="text-muted-foreground">
        {attempt.questionsAttempted !== null &&
          `${attempt.questionsCorrect ?? '?'}/${attempt.questionsAttempted} correct${attempt.accuracy !== null ? ` (${Math.round(attempt.accuracy)}%)` : ''}`}
        {attempt.marksObtained !== null && ` · ${attempt.marksObtained}${attempt.maxMarks !== null ? `/${attempt.maxMarks}` : ''} marks`}
        {attempt.durationMinutes !== null && ` · ${formatMinutes(attempt.durationMinutes)}`}
        {attempt.questionsAttempted === null && attempt.marksObtained === null && attempt.durationMinutes === null && 'No scores recorded'}
      </p>
      {attempt.notes && <p className="text-muted-foreground">{attempt.notes}</p>}
    </div>
    <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label={`Delete attempt ${attempt.slotIndex + 1}`}>
      <Trash2 />
    </Button>
  </li>
);

/**
 * Item details: schedule facts, explicit rescheduling, and practice attempts.
 * Completion is a separate fact from attempts; ticking an item complete does
 * not imply any attempt was made, and recording one never completes an item.
 */
export const ItemDetailDialog = ({
  assessmentId,
  itemId,
  timeZone,
  attemptSlots,
  onOpenChange,
  onEdit,
}: {
  assessmentId: string;
  itemId: string | null;
  timeZone: string;
  attemptSlots: number;
  onOpenChange: (open: boolean) => void;
  onEdit: (item: StudyItem) => void;
}) => {
  const itemQuery = useStudyItem(assessmentId, itemId ?? undefined);
  const { attemptsQuery, deleteAttempt } = useStudyItemMutations(assessmentId, itemId ?? undefined);
  const [recordingSlot, setRecordingSlot] = useState<number | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [deleting, setDeleting] = useState<PracticeAttempt | null>(null);
  const [remindOpen, setRemindOpen] = useState(false);
  const assessments = useAssessments();

  const item = itemQuery.data;
  const attempts = attemptsQuery.data ?? [];
  const usedSlots = new Set(attempts.map((attempt) => attempt.slotIndex));
  const slotCount = Math.max(attemptSlots, ...attempts.map((attempt) => attempt.slotIndex + 1), 0);
  const freeSlots = Array.from({ length: slotCount }, (_, index) => index).filter((index) => !usedSlots.has(index));

  return (
    <Dialog
      open={Boolean(itemId)}
      onOpenChange={(open) => {
        if (!open) {
          setRecordingSlot(null);
          setRescheduling(false);
        }
        onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-2xl">
        {!item ? (
          <>
            <DialogHeader>
              <DialogTitle>Item details</DialogTitle>
              <DialogDescription>Loading the item.</DialogDescription>
            </DialogHeader>
            <LoadingState />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{item.name}</DialogTitle>
              <DialogDescription>
                {[item.subject, item.topic, item.subtopic].filter(Boolean).join(' › ') || 'No subject set'}
              </DialogDescription>
            </DialogHeader>

            {item.description && <p className="whitespace-pre-line text-sm text-muted-foreground">{item.description}</p>}

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd className="mt-0.5 flex gap-1.5"><StatusBadge item={item} /><PriorityBadge priority={item.priority} /></dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Planned start</dt>
                <dd>{formatDate(item.plannedStartDate, timeZone)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Due date</dt>
                <dd>{formatDate(item.dueDate, timeZone)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Estimated</dt>
                <dd>{formatMinutes(item.estimatedMinutes)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Actual (from sessions)</dt>
                <dd>{item.actualMinutes > 0 ? formatMinutes(item.actualMinutes) : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Completed on</dt>
                <dd>{formatDate(item.completedAt, timeZone)}</dd>
              </div>
            </dl>

            <section className="space-y-2" aria-label="Schedule">
              {rescheduling ? (
                <RescheduleForm assessmentId={assessmentId} item={item} timeZone={timeZone} onDone={() => setRescheduling(false)} />
              ) : (
                <Button variant="outline" size="sm" onClick={() => setRescheduling(true)} disabled={item.completed}>
                  <CalendarClock /> Reschedule
                </Button>
              )}
              {item.completed && <p className="text-xs text-muted-foreground">Completed items keep their original dates.</p>}
            </section>

            <section className="space-y-1.5" aria-label="Reminder">
              <Button variant="outline" size="sm" onClick={() => setRemindOpen(true)}>
                <AlarmClock /> Remind me about this
              </Button>
              <p className="text-xs text-muted-foreground">
                There is no reminder unless you add one, and a due date never creates one.
              </p>
            </section>

            <section className="space-y-2" aria-label="Practice attempts">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{`Practice attempts (${attempts.length})`}</h3>
                {recordingSlot === null && freeSlots.length > 0 && (
                  <Button variant="secondary" size="sm" onClick={() => setRecordingSlot(freeSlots[0] ?? 0)}>
                    <Plus /> Record attempt
                  </Button>
                )}
              </div>

              {recordingSlot !== null && (
                <>
                  {freeSlots.length > 1 && (
                    <div className="max-w-[12rem]">
                      <Label htmlFor="att-slot">Slot</Label>
                      <NativeSelect id="att-slot" value={recordingSlot} onChange={(event) => setRecordingSlot(Number(event.target.value))}>
                        {freeSlots.map((slot) => (
                          <option key={slot} value={slot}>{`Attempt ${slot + 1}`}</option>
                        ))}
                      </NativeSelect>
                    </div>
                  )}
                  <AttemptForm
                    key={recordingSlot}
                    assessmentId={assessmentId}
                    itemId={item.id}
                    timeZone={timeZone}
                    slotIndex={recordingSlot}
                    onDone={() => setRecordingSlot(null)}
                  />
                </>
              )}

              {attemptsQuery.isLoading ? (
                <LoadingState />
              ) : attempts.length === 0 && recordingSlot === null ? (
                <p className="text-sm text-muted-foreground">
                  No attempts yet. Attempts are separate from completion, so you can tick this item off without one.
                </p>
              ) : (
                <ul className="space-y-2">
                  {attempts.map((attempt) => (
                    <AttemptRow key={attempt.id} attempt={attempt} timeZone={timeZone} onDelete={() => setDeleting(attempt)} />
                  ))}
                </ul>
              )}
            </section>

            <DialogFooter>
              <Button variant="outline" onClick={() => onEdit(item)}>
                Edit item
              </Button>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>

            <ReminderFormDialog
              open={remindOpen}
              onOpenChange={setRemindOpen}
              assessments={assessments.data ?? []}
              fixedAssessmentId={assessmentId}
              reminder={null}
              defaults={{ studyItemId: item.id, title: `Study: ${item.name}` }}
            />

            <ConfirmDialog
              open={Boolean(deleting)}
              onOpenChange={(open) => !open && setDeleting(null)}
              title="Delete this attempt?"
              description="The attempt record is removed. The item itself is not affected."
              confirmLabel="Delete attempt"
              onConfirm={async () => {
                if (deleting) await deleteAttempt.mutateAsync(deleting.id);
                setDeleting(null);
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
