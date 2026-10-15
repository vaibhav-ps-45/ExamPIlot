import type {
  BookmarkLabel,
  DateStatus,
  DisplayDensity,
  FieldKey,
  Priority,
  ReminderStatus,
  TrackerLayout,
} from '@exampilot/shared';

/**
 * Presentation mappings for domain enums.
 *
 * These live in one module so a status looks identical in every layout: the
 * same "Overdue" badge, the same priority colour, the same layout icon. Nothing
 * here changes data — every value is derived for display only.
 */

export const PRIORITY_META: Record<Priority, { label: string; badge: string; dot: string }> = {
  LOW: { label: 'Low', badge: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  MEDIUM: { label: 'Medium', badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  HIGH: { label: 'High', badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  URGENT: { label: 'Urgent', badge: 'bg-destructive/15 text-destructive', dot: 'bg-destructive' },
};

export const PRIORITY_ORDER: Record<Priority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/**
 * Date status. `OVERDUE` is a label, not a mutation: the due date shown next to
 * it is always the date the user set.
 */
export const DATE_STATUS_META: Record<DateStatus, { label: string; badge: string }> = {
  NO_DATE: { label: 'No date', badge: 'bg-muted text-muted-foreground' },
  NOT_STARTED: { label: 'Not started', badge: 'bg-muted text-muted-foreground' },
  DUE_TODAY: { label: 'Due today', badge: 'bg-warning/15 text-warning' },
  UPCOMING: { label: 'Upcoming', badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  OVERDUE: { label: 'Overdue', badge: 'bg-destructive/15 text-destructive' },
  COMPLETED: { label: 'Completed', badge: 'bg-success/15 text-success' },
};

export const LAYOUT_META: Record<TrackerLayout, { label: string; description: string }> = {
  TABLE: { label: 'Table', description: 'Dense rows with configurable columns.' },
  CHECKLIST: { label: 'Checklist', description: 'Compact to-do list for quick ticking.' },
  NOTES_BOARD: { label: 'Notes board', description: 'Sticky notes, ideal for weak areas.' },
  KANBAN: { label: 'Kanban', description: 'Not implemented yet.' },
};

export const DENSITY_META: Record<DisplayDensity, { label: string; row: string; padding: string }> = {
  COMPACT: { label: 'Compact', row: 'h-9', padding: 'px-2 py-1' },
  COMFORTABLE: { label: 'Comfortable', row: 'h-11', padding: 'px-3 py-2' },
  SPACIOUS: { label: 'Spacious', row: 'h-14', padding: 'px-4 py-3' },
};

export const BOOKMARK_LABEL_META: Record<BookmarkLabel, { label: string; badge: string }> = {
  IMPORTANT: { label: 'Important', badge: 'bg-primary/15 text-primary' },
  DIFFICULT: { label: 'Difficult', badge: 'bg-destructive/15 text-destructive' },
  REVISE: { label: 'Revise', badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  CONTINUE_LATER: { label: 'Continue later', badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  CUSTOM: { label: 'Custom', badge: 'bg-muted text-muted-foreground' },
};

export const REMINDER_STATUS_META: Record<ReminderStatus, { label: string; badge: string }> = {
  PENDING: { label: 'Pending', badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  DELIVERED: { label: 'Delivered', badge: 'bg-success/15 text-success' },
  SNOOZED: { label: 'Snoozed', badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  DISMISSED: { label: 'Dismissed', badge: 'bg-muted text-muted-foreground' },
  MISSED: { label: 'Missed', badge: 'bg-destructive/15 text-destructive' },
};

/** Human labels for the field keys a tracker column can reference. */
export const FIELD_LABELS: Record<FieldKey, string> = {
  NAME: 'Name',
  DESCRIPTION: 'Description',
  SUBJECT: 'Subject',
  TOPIC: 'Topic',
  SUBTOPIC: 'Subtopic',
  PRIORITY: 'Priority',
  STATUS: 'Status',
  PLANNED_START: 'Planned start',
  DUE_DATE: 'Due date',
  COMPLETED_AT: 'Completed on',
  ESTIMATED_MINUTES: 'Estimated time',
  ACTUAL_MINUTES: 'Actual time',
  ATTEMPTS: 'Practice attempts',
  BOOKMARK: 'Saved',
  MOCK_TEST: 'Mock test',
  CUSTOM: 'Custom field',
};

/**
 * Accent colours offered for assessments and trackers. Tailwind needs literal
 * class names, so each option maps to a concrete swatch rather than a built
 * string.
 */
export const ACCENT_OPTIONS = [
  { value: '#4f46e5', label: 'Indigo', swatch: 'bg-indigo-600' },
  { value: '#2563eb', label: 'Blue', swatch: 'bg-blue-600' },
  { value: '#7c3aed', label: 'Violet', swatch: 'bg-violet-600' },
  { value: '#059669', label: 'Emerald', swatch: 'bg-emerald-600' },
  { value: '#d97706', label: 'Amber', swatch: 'bg-amber-600' },
  { value: '#e11d48', label: 'Rose', swatch: 'bg-rose-600' },
  { value: '#0891b2', label: 'Cyan', swatch: 'bg-cyan-600' },
] as const;

export const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
] as const;

/** Turns a stored hex accent into an inline style for custom-coloured chrome. */
export const accentStyle = (hex: string | null | undefined) =>
  hex ? ({ '--accent-color': hex } as React.CSSProperties) : undefined;
