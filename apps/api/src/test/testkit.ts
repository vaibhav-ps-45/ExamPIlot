/**
 * Test helpers. Kept in one module so every suite imports the same fixtures and
 * the same in-memory app instance, and so nothing in a test file imports from a
 * path that would drag in a live database connection at import time.
 */
export {
  passwordSchema,
  createAssessmentSchema,
  createStudyItemSchema,
  createStudySessionSchema,
  createBookmarkSchema,
  createMockTestSchema,
  practiceAttemptSchema,
  switchLayoutSchema,
  rescheduleStudyItemSchema,
  DEFAULT_VIEW_CONFIG,
  LAYOUT_SUPPORTED_FIELDS,
  IMPLEMENTED_LAYOUTS,
} from '@exampilot/shared';

export { buildTree, subjectForPath } from '../modules/syllabus/syllabus.service.js';
export { deriveDateStatus, sessionMinutes } from '../modules/studyItems/studyItem.service.js';
export {
  resolveRemindAt,
  occurrenceKeyFor,
  occurrenceTimeFor,
  notifyAtFor,
  classifyReminder,
  nextOccurrence,
  MISSED_AFTER_MS,
} from '../modules/reminders/reminder.service.js';
export { calendarDaysBetween, daysUntil } from '../lib/dates.js';
