/**
 * Shared domain constants. Kept in one place so the API, the web client and
 * the tests cannot drift apart on enum values or limits.
 */

export const ASSESSMENT_STATUSES = ['PLANNING', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const TRACKER_LAYOUTS = ['TABLE', 'CHECKLIST', 'NOTES_BOARD', 'KANBAN'] as const;
export type TrackerLayout = (typeof TRACKER_LAYOUTS)[number];

/**
 * Layouts that are implemented end-to-end in this MVP. KANBAN is declared in
 * the data model so it can be added without a migration, but the UI does not
 * offer it yet. Attempting to select it returns a clear 400 rather than
 * silently rendering a table.
 */
export const IMPLEMENTED_LAYOUTS: readonly TrackerLayout[] = ['TABLE', 'CHECKLIST', 'NOTES_BOARD'];

export const DISPLAY_DENSITIES = ['COMPACT', 'COMFORTABLE', 'SPACIOUS'] as const;
export type DisplayDensity = (typeof DISPLAY_DENSITIES)[number];

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const FIELD_KEYS = [
  'NAME',
  'DESCRIPTION',
  'SUBJECT',
  'TOPIC',
  'SUBTOPIC',
  'PRIORITY',
  'STATUS',
  'PLANNED_START',
  'DUE_DATE',
  'COMPLETED_AT',
  'ESTIMATED_MINUTES',
  'ACTUAL_MINUTES',
  'ATTEMPTS',
  'BOOKMARK',
  'MOCK_TEST',
  'CUSTOM',
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

/** Fields that make sense in a checklist (notes-board renders a subset too). */
export const CHECKLIST_FIELDS: readonly FieldKey[] = [
  'NAME',
  'SUBJECT',
  'PRIORITY',
  'DUE_DATE',
  'ESTIMATED_MINUTES',
  'ACTUAL_MINUTES',
  'ATTEMPTS',
  'BOOKMARK',
];

export const NOTES_BOARD_FIELDS: readonly FieldKey[] = [
  'NAME',
  'DESCRIPTION',
  'SUBJECT',
  'PRIORITY',
  'DUE_DATE',
  'BOOKMARK',
];

/** Fields every layout can render, used to validate layout switches. */
export const LAYOUT_SUPPORTED_FIELDS: Record<TrackerLayout, readonly FieldKey[]> = {
  TABLE: FIELD_KEYS,
  CHECKLIST: CHECKLIST_FIELDS,
  NOTES_BOARD: NOTES_BOARD_FIELDS,
  KANBAN: ['NAME', 'SUBJECT', 'PRIORITY', 'DUE_DATE', 'BOOKMARK'],
};

export const CUSTOM_FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT'] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const BOOKMARK_LABELS = ['IMPORTANT', 'DIFFICULT', 'REVISE', 'CONTINUE_LATER', 'CUSTOM'] as const;
export type BookmarkLabel = (typeof BOOKMARK_LABELS)[number];

export const BOOKMARK_TARGET_TYPES = ['STUDY_ITEM', 'SYLLABUS_TOPIC', 'NOTE', 'MOCK_TEST'] as const;
export type BookmarkTargetType = (typeof BOOKMARK_TARGET_TYPES)[number];

export const REMINDER_STATUSES = ['PENDING', 'DELIVERED', 'SNOOZED', 'DISMISSED', 'MISSED'] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export const REMINDER_RECURRENCES = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type ReminderRecurrence = (typeof REMINDER_RECURRENCES)[number];

export const THEME_PREFERENCES = ['SYSTEM', 'LIGHT', 'DARK'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const ACCENT_COLORS = [
  'slate',
  'blue',
  'violet',
  'emerald',
  'amber',
  'rose',
  'cyan',
] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];

/** Default number of practice-attempt slots offered on a new tracker. */
export const DEFAULT_ATTEMPT_SLOTS = 4;
export const MIN_ATTEMPT_SLOTS = 1;
export const MAX_ATTEMPT_SLOTS = 12;

/** Pagination defaults. */
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** Assessment categories offered in the UI (free text is still allowed). */
export const ASSESSMENT_CATEGORIES = [
  'Competitive Exam',
  'University Exam',
  'Certification',
  'Interview Prep',
  'Course',
  'Other',
] as const;

/**
 * Date-status vocabulary. These are *derived display states*, never stored
 * schedule mutations. `OVERDUE` changes how a row looks; it never changes
 * `dueDate`.
 */
export const DATE_STATUSES = ['NO_DATE', 'NOT_STARTED', 'DUE_TODAY', 'UPCOMING', 'OVERDUE', 'COMPLETED'] as const;
export type DateStatus = (typeof DATE_STATUSES)[number];
