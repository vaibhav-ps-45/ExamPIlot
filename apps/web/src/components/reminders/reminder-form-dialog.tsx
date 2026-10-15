import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { REMINDER_RECURRENCES, type ReminderRecurrence } from '@exampilot/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDateTime, fromZonedInputValue, toDateTimeLocalValue } from '@/lib/format';
import { useReminderMutations, useStudyItems } from '@/lib/queries';
import type { Assessment, Reminder } from '@/lib/types';

const ADVANCE_OPTIONS = [
  { value: '', label: 'No advance notice' },
  { value: '10', label: '10 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '180', label: '3 hours before' },
  { value: '1440', label: '1 day before' },
];

const RECURRENCE_LABEL: Record<ReminderRecurrence, string> = {
  NONE: 'Does not repeat',
  DAILY: 'Every day',
  WEEKLY: 'Every week',
  MONTHLY: 'Every month',
};

const zoneList = (current: string): string[] => {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  return supported.includes(current) ? supported : [current, ...supported];
};

/**
 * Create or edit a reminder. A reminder exists only because the person pressed
 * "Create" here, and nothing about it (time, repeat, advance) is filled in for
 * them beyond neutral defaults.
 */
export const ReminderFormDialog = ({
  open,
  onOpenChange,
  assessments,
  fixedAssessmentId,
  reminder,
  defaults,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessments: Assessment[];
  fixedAssessmentId?: string;
  reminder: Reminder | null;
  defaults?: { studyItemId?: string; title?: string };
}) => {
  const { create, update } = useReminderMutations();
  const editing = Boolean(reminder);

  const [assessmentId, setAssessmentId] = useState('');
  const [studyItemId, setStudyItemId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [timeZone, setTimeZone] = useState('UTC');
  const [advance, setAdvance] = useState('');
  const [recurrence, setRecurrence] = useState<ReminderRecurrence>('NONE');

  useEffect(() => {
    if (!open) return;
    if (reminder) {
      setAssessmentId(reminder.assessmentId);
      setStudyItemId(reminder.studyItemId ?? '');
      setTitle(reminder.title);
      setMessage(reminder.message ?? '');
      setTimeZone(reminder.timeZone);
      setDateTime(toDateTimeLocalValue(reminder.remindAt, reminder.timeZone));
      setAdvance(reminder.advanceMinutes === null ? '' : String(reminder.advanceMinutes));
      setRecurrence(reminder.recurrence);
    } else {
      const first = assessments.find((entry) => entry.id === fixedAssessmentId) ?? assessments[0];
      setAssessmentId(first?.id ?? '');
      setStudyItemId(defaults?.studyItemId ?? '');
      setTitle(defaults?.title ?? '');
      setMessage('');
      setTimeZone(first?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
      setDateTime('');
      setAdvance('');
      setRecurrence('NONE');
    }
  }, [open, reminder, assessments, fixedAssessmentId, defaults?.studyItemId, defaults?.title]);

  const items = useStudyItems(assessmentId || undefined, { pageSize: 100, sort: 'NAME', completed: 'false' }, { enabled: open && Boolean(assessmentId) });
  const zones = useMemo(() => zoneList(timeZone), [timeZone]);

  const remindAtIso = fromZonedInputValue(dateTime, timeZone);
  const advanceMinutes = advance === '' ? null : Number(advance);
  const notifyAt = remindAtIso ? new Date(new Date(remindAtIso).getTime() - (advanceMinutes ?? 0) * 60_000) : null;

  const scheduleChanged =
    !reminder ||
    remindAtIso !== new Date(reminder.remindAt).toISOString() ||
    timeZone !== reminder.timeZone ||
    advanceMinutes !== reminder.advanceMinutes ||
    recurrence !== reminder.recurrence;
  const inPast = Boolean(notifyAt && notifyAt.getTime() < Date.now() - 60_000);

  let problem: string | null = null;
  if (!title.trim()) problem = 'Give the reminder a title.';
  else if (!remindAtIso) problem = 'Pick a date and time.';
  else if (scheduleChanged && inPast) problem = 'That notification time has already passed. Pick a later time.';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (problem || !remindAtIso) return;
    try {
      if (reminder) {
        const patch: Record<string, unknown> = {};
        if (title.trim() !== reminder.title) patch.title = title.trim();
        if ((message.trim() || null) !== reminder.message) patch.message = message.trim() || null;
        // Only send schedule fields when they changed, so renaming never re-arms a reminder.
        if (remindAtIso !== new Date(reminder.remindAt).toISOString()) patch.remindAt = remindAtIso;
        if (timeZone !== reminder.timeZone) patch.timeZone = timeZone;
        if (advanceMinutes !== reminder.advanceMinutes) patch.advanceMinutes = advanceMinutes;
        if (recurrence !== reminder.recurrence) patch.recurrence = recurrence;
        if (Object.keys(patch).length > 0) await update.mutateAsync({ id: reminder.id, ...patch });
        toast.success('Reminder updated');
      } else {
        await create.mutateAsync({
          assessmentId,
          title: title.trim(),
          message: message.trim() || null,
          remindAt: remindAtIso,
          timeZone,
          advanceMinutes,
          recurrence,
          studyItemId: studyItemId || null,
          enabled: true,
        });
        toast.success('Reminder created');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the reminder');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit reminder' : 'New reminder'}</DialogTitle>
          <DialogDescription>
            You choose when it fires. It never moves your tasks or dates, and a missed one is shown, not resent.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4" noValidate>
          {!editing && !fixedAssessmentId && assessments.length > 1 && (
            <div>
              <Label htmlFor="rm-assessment">Assessment</Label>
              <NativeSelect
                id="rm-assessment"
                value={assessmentId}
                onChange={(event) => {
                  setAssessmentId(event.target.value);
                  setStudyItemId('');
                  const next = assessments.find((entry) => entry.id === event.target.value);
                  if (next) setTimeZone(next.timeZone);
                }}
              >
                {assessments.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}

          <div>
            <Label htmlFor="rm-title">Title</Label>
            <Input id="rm-title" autoFocus value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
          </div>

          {!editing && (
            <div>
              <Label htmlFor="rm-item">About a study item (optional)</Label>
              <NativeSelect
                id="rm-item"
                value={studyItemId}
                onChange={(event) => {
                  setStudyItemId(event.target.value);
                  const picked = items.data?.items.find((item) => item.id === event.target.value);
                  if (picked && !title.trim()) setTitle(`Study: ${picked.name}`);
                }}
              >
                <option value="">Not linked to an item</option>
                {(items.data?.items ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="rm-when">Date and time</Label>
              <Input id="rm-when" type="datetime-local" value={dateTime} onChange={(event) => setDateTime(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="rm-zone">Time zone</Label>
              <NativeSelect id="rm-zone" value={timeZone} onChange={(event) => setTimeZone(event.target.value)}>
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="rm-advance">Advance notice</Label>
              <NativeSelect id="rm-advance" value={advance} onChange={(event) => setAdvance(event.target.value)}>
                {ADVANCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="rm-repeat">Repeat</Label>
              <NativeSelect id="rm-repeat" value={recurrence} onChange={(event) => setRecurrence(event.target.value as ReminderRecurrence)}>
                {REMINDER_RECURRENCES.map((entry) => (
                  <option key={entry} value={entry}>
                    {RECURRENCE_LABEL[entry]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          {notifyAt && !problem && (
            <p className="text-xs text-muted-foreground">
              {`You will be notified on ${formatDateTime(notifyAt.toISOString(), timeZone)} (${timeZone}).`}
            </p>
          )}
          {problem && dateTime !== '' && (
            <p role="alert" className="text-xs text-destructive">
              {problem}
            </p>
          )}

          <div>
            <Label htmlFor="rm-message">Message (optional)</Label>
            <Textarea id="rm-message" rows={2} value={message} maxLength={1000} onChange={(event) => setMessage(event.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={Boolean(problem) || create.isPending || update.isPending}>
              {editing ? 'Save changes' : 'Create reminder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
