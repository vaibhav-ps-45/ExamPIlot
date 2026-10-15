import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { PRIORITIES } from '@exampilot/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { PRIORITY_META } from '@/lib/domain';
import { fromZonedInputValue, toDateInputValue } from '@/lib/format';
import { useStudyItemMutations } from '@/lib/queries';
import type { CustomField, StudyItem, Tracker } from '@/lib/types';

const formSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the item a name').max(300),
    description: z.string().max(4000),
    subject: z.string().max(200),
    topic: z.string().max(200),
    subtopic: z.string().max(200),
    priority: z.enum(PRIORITIES),
    plannedStart: z.string(),
    due: z.string(),
    estimatedMinutes: z.string().regex(/^\d{0,6}$/, 'Whole minutes only'),
    trackerId: z.string(),
    custom: z.record(z.string()),
  })
  .refine((v) => !v.plannedStart || !v.due || v.plannedStart <= v.due, {
    message: 'Planned start must be on or before the due date',
    path: ['due'],
  });

type FormValues = z.infer<typeof formSchema>;

const blank = (trackerId: string): FormValues => ({
  name: '',
  description: '',
  subject: '',
  topic: '',
  subtopic: '',
  priority: 'MEDIUM',
  plannedStart: '',
  due: '',
  estimatedMinutes: '',
  trackerId,
  custom: {},
});

const FieldError = ({ message }: { message?: string }) =>
  message ? (
    <p role="alert" className="mt-1 text-xs text-destructive">
      {message}
    </p>
  ) : null;

/**
 * Create or edit a study item.
 *
 * Editing deliberately does not show date inputs. Planned and due dates change
 * only through the explicit "Reschedule" action, which records the previous
 * dates and a reason so planning accuracy can be reviewed later.
 */
export const ItemFormDialog = ({
  open,
  onOpenChange,
  assessmentId,
  timeZone,
  item,
  tracker,
  trackers,
  customFields,
  defaults,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentId: string;
  timeZone: string;
  item: StudyItem | null;
  tracker: Tracker;
  trackers: Tracker[];
  customFields: CustomField[];
  defaults?: Partial<FormValues>;
}) => {
  const { create, update } = useStudyItemMutations(assessmentId);
  const editing = Boolean(item);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: blank(tracker.id) });

  useEffect(() => {
    if (!open) return;
    if (item) {
      reset({
        name: item.name,
        description: item.description ?? '',
        subject: item.subject ?? '',
        topic: item.topic ?? '',
        subtopic: item.subtopic ?? '',
        priority: item.priority,
        plannedStart: toDateInputValue(item.plannedStartDate, timeZone),
        due: toDateInputValue(item.dueDate, timeZone),
        estimatedMinutes: item.estimatedMinutes === null ? '' : String(item.estimatedMinutes),
        trackerId: item.trackerId ?? '',
        custom: Object.fromEntries(item.customValues.map((value) => [value.customFieldId, value.value ?? ''])),
      });
    } else {
      reset({ ...blank(tracker.id), ...defaults });
    }
  }, [open, item, tracker.id, timeZone, reset, defaults]);

  const onSubmit = handleSubmit(async (values) => {
    const customValues = customFields.map((field) => ({
      customFieldId: field.id,
      value: values.custom[field.id]?.trim() ? values.custom[field.id]!.trim() : null,
    }));
    const text = (value: string) => (value.trim() === '' ? null : value.trim());
    const minutes = values.estimatedMinutes === '' ? null : Number(values.estimatedMinutes);

    try {
      if (item) {
        // Dates are intentionally absent: see the component comment.
        await update.mutateAsync({
          id: item.id,
          name: values.name.trim(),
          description: text(values.description),
          subject: text(values.subject),
          topic: text(values.topic),
          subtopic: text(values.subtopic),
          priority: values.priority,
          estimatedMinutes: minutes,
          trackerId: values.trackerId || null,
          customValues,
        });
        toast.success('Item updated');
      } else {
        await create.mutateAsync({
          name: values.name.trim(),
          description: text(values.description),
          subject: text(values.subject),
          topic: text(values.topic),
          subtopic: text(values.subtopic),
          priority: values.priority,
          plannedStartDate: fromZonedInputValue(values.plannedStart, timeZone),
          dueDate: fromZonedInputValue(values.due, timeZone),
          estimatedMinutes: minutes,
          trackerId: values.trackerId || null,
          customValues,
        });
        toast.success('Item added');
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.length > 0) {
        for (const entry of error.fieldErrors) {
          const path = entry.path === 'dueDate' ? 'due' : entry.path;
          if (path in blank('')) setError(path as keyof FormValues, { message: entry.message });
        }
      }
      toast.error(error instanceof Error ? error.message : 'Could not save the item');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit item' : 'New study item'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'To change planned or due dates, use Reschedule in the item details.'
              : 'Only the name is required. Nothing here creates a reminder.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div>
            <Label htmlFor="item-name">Name</Label>
            <Input id="item-name" autoFocus {...register('name')} aria-invalid={Boolean(errors.name)} />
            <FieldError message={errors.name?.message} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="item-subject">Subject</Label>
              <Input id="item-subject" {...register('subject')} />
            </div>
            <div>
              <Label htmlFor="item-topic">Topic</Label>
              <Input id="item-topic" {...register('topic')} />
            </div>
            <div>
              <Label htmlFor="item-subtopic">Subtopic</Label>
              <Input id="item-subtopic" {...register('subtopic')} />
            </div>
          </div>

          <div>
            <Label htmlFor="item-description">Description or notes</Label>
            <Textarea id="item-description" rows={3} {...register('description')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="item-priority">Priority</Label>
              <NativeSelect id="item-priority" {...register('priority')}>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_META[priority].label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="item-estimate">Estimated minutes</Label>
              <Input id="item-estimate" inputMode="numeric" placeholder="e.g. 90" {...register('estimatedMinutes')} />
              <FieldError message={errors.estimatedMinutes?.message} />
            </div>
            <div>
              <Label htmlFor="item-tracker">Tracker</Label>
              <NativeSelect id="item-tracker" {...register('trackerId')}>
                <option value="">None</option>
                {trackers.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          {!editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="item-start">Planned start</Label>
                <Input id="item-start" type="date" {...register('plannedStart')} />
              </div>
              <div>
                <Label htmlFor="item-due">Due date</Label>
                <Input id="item-due" type="date" {...register('due')} aria-invalid={Boolean(errors.due)} />
                <FieldError message={errors.due?.message} />
              </div>
            </div>
          )}

          {customFields.length > 0 && (
            <fieldset className="grid gap-4 rounded-md border border-border p-3 sm:grid-cols-2">
              <legend className="px-1 text-xs font-medium text-muted-foreground">Custom fields</legend>
              {customFields.map((field) => (
                <div key={field.id}>
                  <Label htmlFor={`cf-${field.id}`}>{field.label}</Label>
                  {field.type === 'SELECT' ? (
                    <NativeSelect id={`cf-${field.id}`} {...register(`custom.${field.id}`)}>
                      <option value="">—</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : field.type === 'BOOLEAN' ? (
                    <NativeSelect id={`cf-${field.id}`} {...register(`custom.${field.id}`)}>
                      <option value="">—</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </NativeSelect>
                  ) : (
                    <Input
                      id={`cf-${field.id}`}
                      type={field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : 'text'}
                      {...register(`custom.${field.id}`)}
                    />
                  )}
                </div>
              ))}
            </fieldset>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {editing ? 'Save changes' : 'Add item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
