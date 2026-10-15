import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlarmClock, BellOff, BellRing, Moon, Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states';
import { ReminderFormDialog } from '@/components/reminders/reminder-form-dialog';
import { REMINDER_STATUS_META } from '@/lib/domain';
import { formatDateTime } from '@/lib/format';
import { useAssessments, useReminderMutations, useReminders, useSettings, useUpdateSettings } from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { Reminder } from '@/lib/types';

const SNOOZE_OPTIONS = [
  { minutes: 10, label: '10 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 180, label: '3 hours' },
  { minutes: 1440, label: '1 day' },
];

const RECURRENCE_TEXT = { NONE: '', DAILY: 'Repeats daily', WEEKLY: 'Repeats weekly', MONTHLY: 'Repeats monthly' } as const;

type Group = 'upcoming' | 'missed' | 'paused' | 'past';

/** One place decides which section a reminder is in, so a reminder is never in two. */
export const groupOf = (reminder: Reminder): Group => {
  if (reminder.isMissed) return 'missed';
  if (!reminder.enabled) return 'paused';
  if (reminder.status === 'PENDING' || reminder.status === 'SNOOZED') return 'upcoming';
  return 'past';
};

const NotificationSettings = ({ activeCount }: { activeCount: number }) => {
  const settings = useSettings();
  const update = useUpdateSettings();
  const { disableAll } = useReminderMutations();
  const [confirmOff, setConfirmOff] = useState(false);
  const supported = typeof Notification !== 'undefined';
  const permission = supported ? Notification.permission : 'denied';
  const data = settings.data;

  const setBrowser = async (checked: boolean) => {
    if (!checked) {
      await update.mutateAsync({ browserNotificationsEnabled: false });
      return;
    }
    if (!supported) return;
    const result = permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (result === 'granted') {
      await update.mutateAsync({ browserNotificationsEnabled: true });
      toast.success('Browser notifications are on.');
    } else {
      toast.error('Your browser blocked notifications. You can allow them in the site settings.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">How you are notified</CardTitle>
        <CardDescription>Nothing is sent unless you created a reminder. In-app messages are on by default; browser notifications stay off until you allow them.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={data?.inAppNotificationsEnabled ?? false}
            disabled={!data || update.isPending}
            onCheckedChange={(checked) => update.mutate({ inAppNotificationsEnabled: checked === true })}
          />
          <span>
            In-app notifications
            <span className="block text-xs text-muted-foreground">A message appears on screen while ExamPilot is open.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={(data?.browserNotificationsEnabled ?? false) && permission === 'granted'}
            disabled={!data || update.isPending || !supported || permission === 'denied'}
            onCheckedChange={(checked) => void setBrowser(checked === true)}
          />
          <span>
            Browser notifications
            <span className="block text-xs text-muted-foreground">
              {!supported
                ? 'This browser does not support notifications.'
                : permission === 'denied'
                  ? 'Blocked by your browser. Allow notifications for this site to use this.'
                  : 'Needs your permission. They only appear while an ExamPilot tab is open.'}
            </span>
          </span>
        </label>

        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          Delivery limits: the server checks for due reminders every minute while it is running, and this app picks them up
          every 30 seconds while a tab is open. A reminder more than 30 minutes late is not sent; it moves to Missed so you can
          decide. A recurring reminder skips ahead to its next time instead of sending a backlog.
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-sm text-muted-foreground">Want everything quiet? This switches every reminder off. You turn them back on one by one.</p>
          <Button variant="outline" size="sm" disabled={activeCount === 0 || disableAll.isPending} onClick={() => setConfirmOff(true)}>
            <BellOff /> Turn all off
          </Button>
        </div>
      </CardContent>
      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title="Turn off every reminder?"
        description="All your reminders are switched off. They are not deleted, and nothing turns them back on automatically."
        confirmLabel="Turn all off"
        onConfirm={async () => {
          try {
            const result = await disableAll.mutateAsync();
            toast.success(`${result.updated} reminder${result.updated === 1 ? '' : 's'} turned off.`);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not turn reminders off');
          }
          setConfirmOff(false);
        }}
      />
    </Card>
  );
};

const ReminderRow = ({
  reminder,
  assessmentName,
  onEdit,
  onDelete,
}: {
  reminder: Reminder;
  assessmentName: string | undefined;
  onEdit: (reminder: Reminder) => void;
  onDelete: (reminder: Reminder) => void;
}) => {
  const { update, action } = useReminderMutations();
  const status = REMINDER_STATUS_META[reminder.status];
  const group = groupOf(reminder);

  const run = async (work: () => Promise<unknown>, success: string) => {
    try {
      await work();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That did not work');
    }
  };

  return (
    <li className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
      <label className="flex items-center gap-2 text-xs text-muted-foreground sm:pt-1">
        <Checkbox
          checked={reminder.enabled}
          disabled={update.isPending}
          onCheckedChange={(checked) =>
            void run(() => update.mutateAsync({ id: reminder.id, enabled: checked === true }), checked === true ? 'Reminder on' : 'Reminder off')
          }
          aria-label={`${reminder.enabled ? 'Turn off' : 'Turn on'} ${reminder.title}`}
        />
        On
      </label>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn('text-sm font-medium', !reminder.enabled && 'text-muted-foreground')}>{reminder.title}</p>
          {reminder.isMissed ? (
            <Badge className="border-transparent bg-destructive/15 text-destructive">Missed</Badge>
          ) : (
            <Badge className={cn('border-transparent', status.badge)}>{status.label}</Badge>
          )}
          {RECURRENCE_TEXT[reminder.recurrence] && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Repeat className="size-3" /> {RECURRENCE_TEXT[reminder.recurrence]}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {[
            formatDateTime(reminder.remindAt, reminder.timeZone),
            reminder.timeZone,
            reminder.advanceMinutes ? `notifies ${reminder.advanceMinutes >= 60 ? `${reminder.advanceMinutes / 60}h` : `${reminder.advanceMinutes}m`} before` : null,
            assessmentName,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {reminder.status === 'SNOOZED' && reminder.snoozedUntil && (
          <p className="text-xs text-muted-foreground">{`Snoozed until ${formatDateTime(reminder.snoozedUntil, reminder.timeZone)}`}</p>
        )}
        {reminder.message && <p className="text-sm text-muted-foreground">{reminder.message}</p>}
        {group === 'missed' && (
          <p className="text-xs text-muted-foreground">
            Not sent in time. Nothing was rescheduled or created. Pick a new time, or dismiss it.
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {(group === 'upcoming' || (group === 'past' && reminder.status === 'DELIVERED')) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Moon /> Snooze
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SNOOZE_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.minutes}
                  onSelect={() => void run(() => action.mutateAsync({ id: reminder.id, action: 'snooze', snoozeMinutes: option.minutes }), `Snoozed for ${option.label}`)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {group === 'missed' && (
          <Button variant="outline" size="sm" onClick={() => onEdit(reminder)}>
            Pick a new time
          </Button>
        )}
        {reminder.status !== 'DISMISSED' && (
          <Button
            variant="ghost"
            size="sm"
            disabled={action.isPending}
            onClick={() => void run(() => action.mutateAsync({ id: reminder.id, action: 'dismiss' }), 'Dismissed')}
          >
            Dismiss
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${reminder.title}`} onClick={() => onEdit(reminder)}>
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${reminder.title}`} onClick={() => onDelete(reminder)}>
          <Trash2 />
        </Button>
      </div>
    </li>
  );
};

const Section = ({
  title,
  hint,
  reminders,
  names,
  onEdit,
  onDelete,
}: {
  title: string;
  hint?: string;
  reminders: Reminder[];
  names: Map<string, string>;
  onEdit: (reminder: Reminder) => void;
  onDelete: (reminder: Reminder) => void;
}) =>
  reminders.length === 0 ? null : (
    <section className="space-y-2" aria-label={title}>
      <div>
        <h2 className="text-sm font-semibold">{`${title} (${reminders.length})`}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {reminders.map((reminder) => (
          <ReminderRow key={reminder.id} reminder={reminder} assessmentName={names.get(reminder.assessmentId)} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </ul>
    </section>
  );

export const RemindersPage = () => {
  const reminders = useReminders({ pageSize: 100 });
  const assessments = useAssessments();
  const { remove } = useReminderMutations();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [deleting, setDeleting] = useState<Reminder | null>(null);

  const names = useMemo(() => new Map((assessments.data ?? []).map((entry) => [entry.id, entry.name] as const)), [assessments.data]);
  const items = reminders.data?.items ?? [];
  const grouped = useMemo(() => {
    const result: Record<Group, Reminder[]> = { upcoming: [], missed: [], paused: [], past: [] };
    for (const reminder of items) result[groupOf(reminder)].push(reminder);
    result.past.reverse(); // newest first
    return result;
  }, [items]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reminders</h1>
          <p className="text-sm text-muted-foreground">
            Only reminders you create appear here. Creating a topic, setting a deadline or missing a session never adds one.
          </p>
        </div>
        <Button onClick={openNew} disabled={(assessments.data?.length ?? 0) === 0}>
          <Plus /> New reminder
        </Button>
      </header>

      <NotificationSettings activeCount={items.filter((reminder) => reminder.enabled).length} />

      {reminders.isLoading ? (
        <ListSkeleton rows={4} />
      ) : reminders.error ? (
        <ErrorState error={reminders.error} onRetry={() => void reminders.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<AlarmClock className="size-5" />}
          title="No reminders"
          description={
            (assessments.data?.length ?? 0) === 0
              ? 'Create an assessment first, then you can add a reminder for it.'
              : 'That is the default. Add one when you want to be nudged about something specific.'
          }
          action={
            (assessments.data?.length ?? 0) > 0 ? (
              <Button onClick={openNew}>
                <BellRing /> Create a reminder
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          <Section title="Missed" hint="These were not sent in time. They are never sent late and never rescheduled for you." reminders={grouped.missed} names={names} onEdit={(entry) => { setEditing(entry); setFormOpen(true); }} onDelete={setDeleting} />
          <Section title="Upcoming" reminders={grouped.upcoming} names={names} onEdit={(entry) => { setEditing(entry); setFormOpen(true); }} onDelete={setDeleting} />
          <Section title="Turned off" hint="These will not notify you until you switch them on." reminders={grouped.paused} names={names} onEdit={(entry) => { setEditing(entry); setFormOpen(true); }} onDelete={setDeleting} />
          <Section title="Done" reminders={grouped.past} names={names} onEdit={(entry) => { setEditing(entry); setFormOpen(true); }} onDelete={setDeleting} />
          {(reminders.data?.total ?? 0) > items.length && (
            <p className="text-xs text-muted-foreground">{`Showing the first ${items.length} of ${reminders.data?.total} reminders.`}</p>
          )}
        </div>
      )}

      <ReminderFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        assessments={assessments.data ?? []}
        reminder={editing}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.title ?? ''}"?`}
        description="The reminder is removed. The study item it was about is not affected."
        confirmLabel="Delete reminder"
        onConfirm={async () => {
          if (deleting) {
            try {
              await remove.mutateAsync(deleting.id);
              toast.success('Reminder deleted');
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Could not delete the reminder');
            }
          }
          setDeleting(null);
        }}
      />
    </div>
  );
};
