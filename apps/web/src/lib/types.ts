import type {
  AssessmentStatus,
  BookmarkLabel,
  BookmarkTargetType,
  CustomFieldType,
  DateStatus,
  DisplayDensity,
  FieldKey,
  Priority,
  ReminderRecurrence,
  ReminderStatus,
  ThemePreference,
  TrackerLayout,
} from '@exampilot/shared';

/**
 * Response types for the API.
 *
 * These mirror the backend view models. They are hand-written rather than
 * inferred from Prisma because the API deliberately returns derived fields
 * (dateStatus, daysUntilDue, isBookmarked, percentage) that do not exist as
 * columns — and those are exactly the fields the UI renders.
 */

export interface User {
  id: string;
  email: string;
  displayName: string;
  timeZone: string;
  createdAt: string;
}

export interface SchedulePreference {
  preferredStudyDays: number[];
  dailyTargetMinutes: number | null;
  trackScheduleAdherence: boolean;
}

export interface Assessment {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  startDate: string | null;
  examDate: string | null;
  timeZone: string;
  status: AssessmentStatus;
  accentColor: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** null when no exam date is set. Computed in the assessment's time zone. */
  daysUntilExam: number | null;
  examDatePassed: boolean;
  schedulePreference: SchedulePreference | null;
}

export interface SyllabusNode {
  id: string;
  assessmentId: string;
  parentId: string | null;
  title: string;
  description: string | null;
  weight: number | null;
  sortOrder: number;
  depth: number;
  studyItemCount: number;
  children: SyllabusNode[];
}

export interface CustomValue {
  customFieldId: string;
  key: string;
  label: string;
  value: string | null;
}

export interface StudyItem {
  id: string;
  assessmentId: string;
  trackerId: string | null;
  syllabusNodeId: string | null;
  name: string;
  description: string | null;
  subject: string | null;
  topic: string | null;
  subtopic: string | null;
  priority: Priority;
  plannedStartDate: string | null;
  dueDate: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number;
  completed: boolean;
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /** Derived display state. OVERDUE never means the stored date moved. */
  dateStatus: DateStatus;
  daysUntilDue: number | null;
  isOverdue: boolean;
  trackedMinutes: number;
  attemptCount: number;
  isBookmarked: boolean;
  customValues: CustomValue[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PracticeAttempt {
  id: string;
  studyItemId: string;
  slotIndex: number;
  attemptedAt: string;
  questionsAttempted: number | null;
  questionsCorrect: number | null;
  marksObtained: number | null;
  maxMarks: number | null;
  durationMinutes: number | null;
  notes: string | null;
  accuracy: number | null;
  percentage: number | null;
}

export interface StudySession {
  id: string;
  assessmentId: string;
  studyItemId: string | null;
  startedAt: string;
  endedAt: string | null;
  manualMinutes: number | null;
  effectiveMinutes: number;
  notes: string | null;
  createdAt: string;
}

export interface TrackerColumn {
  id: string;
  fieldKey: FieldKey;
  customFieldId: string | null;
  label: string | null;
  width: number | null;
  visible: boolean;
  sortOrder: number;
}

export interface TrackerViewConfig {
  attemptSlots: number;
  showCompleted: boolean;
  groupBySubject: boolean;
  notesBoardColumns: number;
}

export interface Tracker {
  id: string;
  assessmentId: string;
  name: string;
  layout: TrackerLayout;
  accentColor: string | null;
  density: DisplayDensity;
  viewConfig: TrackerViewConfig;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  columns: TrackerColumn[];
  itemCount: number;
  savedViews: Array<{ id: string; name: string; isDefault: boolean }>;
}

export interface SavedView {
  id: string;
  name: string;
  isDefault: boolean;
  layout: TrackerLayout | null;
  density: DisplayDensity | null;
  filters: Record<string, unknown> | null;
  sorts: Record<string, unknown> | null;
  searchTerm: string | null;
}

export interface Bookmark {
  id: string;
  targetType: BookmarkTargetType;
  targetId: string;
  label: BookmarkLabel;
  customLabel: string | null;
  reason: string | null;
  createdAt: string;
  assessmentId: string | null;
  title: string;
  subtitle: string | null;
  subject: string | null;
  dueDate: string | null;
  completed: boolean | null;
  /** Where to open the item in its original context. */
  contextPath: string;
}

export interface Note {
  id: string;
  assessmentId: string;
  studyItemId: string | null;
  syllabusNodeId: string | null;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  isBookmarked: boolean;
  excerpt: string;
}

export interface MockTestSection {
  name: string;
  totalMarks: number;
  marksObtained: number;
  notes?: string | null;
}

export interface MockTest {
  id: string;
  assessmentId: string;
  name: string;
  takenOn: string;
  totalMarks: number;
  marksObtained: number;
  percentage: number;
  durationMinutes: number | null;
  sections: MockTestSection[] | null;
  notes: string | null;
  reviewed: boolean;
  createdAt: string;
  updatedAt: string;
  isBookmarked: boolean;
}

export interface MockTestSummary {
  count: number;
  averagePercentage: number | null;
  bestPercentage: number | null;
  latestPercentage: number | null;
  trend: Array<{ id: string; name: string; takenOn: string; percentage: number }>;
}

export interface ReminderDelivery {
  channel: 'IN_APP' | 'BROWSER';
  status: 'QUEUED' | 'DELIVERED' | 'FAILED';
  scheduledFor: string;
  deliveredAt: string | null;
}

export interface Reminder {
  id: string;
  assessmentId: string;
  studyItemId: string | null;
  title: string;
  message: string | null;
  remindAt: string;
  localDateTime: string | null;
  timeZone: string;
  advanceMinutes: number | null;
  recurrence: ReminderRecurrence;
  status: ReminderStatus;
  enabled: boolean;
  snoozedUntil: string | null;
  dismissedAt: string | null;
  lastFiredAt: string | null;
  createdAt: string;
  /** Display only. A missed reminder is never auto-rescheduled or duplicated. */
  isMissed: boolean;
  deliveries: ReminderDelivery[];
}

export interface AssessmentAnalytics {
  assessmentId: string;
  daysUntilExam: number | null;
  totals: {
    items: number;
    completedItems: number;
    completionPercentage: number;
    subjects: number;
    syllabusNodes: number;
    bookmarkedItems: number;
    attemptsRecorded: number;
    notes: number;
  };
  time: {
    estimatedMinutes: number;
    actualMinutes: number;
    remainingEstimatedMinutes: number;
    sessionCount: number;
    plannedVsActualRatio: number | null;
  };
  schedule: {
    dueToday: number;
    upcoming: number;
    overdue: number;
    noDate: number;
    completedOnTime: number;
    completedLate: number;
    adherencePercentage: number | null;
    totalSlippageDays: number;
  };
  bookmarksByLabel: Array<{ label: BookmarkLabel; count: number }>;
  mockTests: MockTestSummary;
  recentSessions: Array<{
    id: string;
    studyItemId: string | null;
    itemName: string | null;
    startedAt: string;
    minutes: number;
    notes: string | null;
  }>;
  upcomingDeadlines: Array<{
    id: string;
    name: string;
    subject: string | null;
    dueDate: string;
    daysUntilDue: number;
    isOverdue: boolean;
    completed: boolean;
  }>;
}

export interface OverviewRow {
  id: string;
  name: string;
  status: AssessmentStatus;
  accentColor: string | null;
  examDate: string | null;
  daysUntilExam: number | null;
  items: number;
  completedItems: number;
  completionPercentage: number;
  estimatedMinutes: number;
  actualMinutes: number;
  overdueItems: number;
  bookmarkedItems: number;
}

export interface GlobalOverview {
  assessments: OverviewRow[];
  totals: {
    assessments: number;
    items: number;
    completedItems: number;
    actualMinutes: number;
    overdueItems: number;
    bookmarkedItems: number;
  };
}

export interface CustomField {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  sortOrder: number;
}

export interface Settings {
  theme: ThemePreference;
  defaultTimeZone: string;
  browserNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
}

export interface SessionRecord {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface SyllabusTemplateSummary {
  id: string;
  name: string;
  description: string;
  nodeCount: number;
}
