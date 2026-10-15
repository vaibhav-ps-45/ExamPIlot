import { Prisma } from '@prisma/client';
import type { CreateStudyItemInput, PracticeAttemptInput, UpdateStudyItemInput } from '@exampilot/shared';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { calendarDaysBetween, startOfDayInZone } from '../../lib/dates.js';
import { toSkipTake } from '../../lib/pagination.js';
import { getAssessmentForUser } from '../assessments/assessment.service.js';

export interface StudyItemView {
  id: string;
  assessmentId: string;
  trackerId: string | null;
  syllabusNodeId: string | null;
  name: string;
  description: string | null;
  subject: string | null;
  topic: string | null;
  subtopic: string | null;
  priority: string;
  plannedStartDate: string | null;
  dueDate: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number;
  completed: boolean;
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /** Derived display status. Overdue never mutates dueDate. */
  dateStatus: 'NO_DATE' | 'NOT_STARTED' | 'DUE_TODAY' | 'UPCOMING' | 'OVERDUE' | 'COMPLETED';
  daysUntilDue: number | null;
  isOverdue: boolean;
  /** Session-derived, never double counted. */
  trackedMinutes: number;
  attemptCount: number;
  isBookmarked: boolean;
  /** Id of this item's bookmark, so clients can remove it without searching the list. */
  bookmarkId: string | null;
  customValues: Array<{ customFieldId: string; key: string; label: string; value: string | null }>;
}

const ITEM_SELECT = {
  id: true,
  assessmentId: true,
  trackerId: true,
  syllabusNodeId: true,
  name: true,
  description: true,
  subject: true,
  topic: true,
  subtopic: true,
  priority: true,
  plannedStartDate: true,
  dueDate: true,
  estimatedMinutes: true,
  actualMinutes: true,
  completed: true,
  completedAt: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  bookmarks: { select: { id: true }, take: 1 },
  _count: { select: { attempts: true, bookmarks: true } },
  customValues: {
    select: {
      customFieldId: true,
      value: true,
      customField: { select: { key: true, label: true } },
    },
  },
} satisfies Prisma.StudyItemSelect;

type ItemRow = Prisma.StudyItemGetPayload<{ select: typeof ITEM_SELECT }>;

/**
 * Duration is derived from sessions exactly once:
 * - a session with both start and end contributes its elapsed minutes,
 * - a session with only manualMinutes contributes those,
 * - a session with both is impossible (enforced by the create schema).
 */
export const sessionMinutes = (session: {
  startedAt: Date;
  endedAt: Date | null;
  manualMinutes: number | null;
}): number => {
  if (session.startedAt && session.endedAt) {
    const diff = Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 60000);
    return diff > 0 ? diff : 0;
  }
  return session.manualMinutes && session.manualMinutes > 0 ? session.manualMinutes : 0;
};

export const deriveDateStatus = (
  item: { completed: boolean; dueDate: Date | null },
  timeZone: string,
  now: Date = new Date(),
): StudyItemView['dateStatus'] => {
  if (item.completed) return 'COMPLETED';
  if (!item.dueDate) return 'NO_DATE';
  const days = calendarDaysBetween(now, item.dueDate, timeZone);
  if (days < 0) return 'OVERDUE';
  if (days === 0) return 'DUE_TODAY';
  return 'UPCOMING';
};

const toView = (
  row: ItemRow & { trackedMinutes?: number },
  timeZone: string,
  now: Date = new Date(),
): StudyItemView => {
  const dateStatus = deriveDateStatus(row, timeZone, now);
  return {
    id: row.id,
    assessmentId: row.assessmentId,
    trackerId: row.trackerId,
    syllabusNodeId: row.syllabusNodeId,
    name: row.name,
    description: row.description,
    subject: row.subject,
    topic: row.topic,
    subtopic: row.subtopic,
    priority: row.priority,
    plannedStartDate: row.plannedStartDate?.toISOString() ?? null,
    dueDate: row.dueDate?.toISOString() ?? null,
    estimatedMinutes: row.estimatedMinutes,
    actualMinutes: row.actualMinutes ?? row.trackedMinutes ?? 0,
    completed: row.completed,
    completedAt: row.completedAt?.toISOString() ?? null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    dateStatus,
    daysUntilDue: row.dueDate ? calendarDaysBetween(now, row.dueDate, timeZone) : null,
    isOverdue: dateStatus === 'OVERDUE',
    trackedMinutes: row.trackedMinutes ?? row.actualMinutes ?? 0,
    attemptCount: row._count.attempts,
    isBookmarked: row._count.bookmarks > 0,
    bookmarkId: row.bookmarks[0]?.id ?? null,
    customValues: row.customValues.map((value) => ({
      customFieldId: value.customFieldId,
      key: value.customField.key,
      label: value.customField.label,
      value: value.value,
    })),
  };
};

/**
 * Recomputes and stores `actualMinutes` for one item from its sessions.
 * Runs inside the caller's transaction so the denormalised value can never
 * drift from the session rows.
 */
export const recomputeActualMinutes = async (
  tx: Prisma.TransactionClient,
  studyItemId: string,
): Promise<number> => {
  const sessions = await tx.studySession.findMany({
    where: { studyItemId },
    select: { startedAt: true, endedAt: true, manualMinutes: true },
  });
  const total = sessions.reduce((sum, session) => sum + sessionMinutes(session), 0);
  await tx.studyItem.update({ where: { id: studyItemId }, data: { actualMinutes: total } });
  return total;
};

const assertCustomFieldsBelong = async (assessmentId: string, customFieldIds: string[]): Promise<void> => {
  if (customFieldIds.length === 0) return;
  const found = await prisma.assessmentCustomField.findMany({
    where: { id: { in: customFieldIds }, assessmentId },
    select: { id: true },
  });
  if (found.length !== customFieldIds.length) {
    throw AppError.validation('A custom field does not belong to this assessment');
  }
};

const assertTrackerBelongs = async (assessmentId: string, trackerId: string | null): Promise<void> => {
  if (!trackerId) return;
  const tracker = await prisma.tracker.findUnique({
    where: { id: trackerId },
    select: { assessmentId: true },
  });
  if (!tracker || tracker.assessmentId !== assessmentId) {
    throw AppError.validation('Tracker does not belong to this assessment');
  }
};

const assertSyllabusNodeBelongs = async (assessmentId: string, nodeId: string | null): Promise<void> => {
  if (!nodeId) return;
  const node = await prisma.syllabusNode.findUnique({
    where: { id: nodeId },
    select: { assessmentId: true },
  });
  if (!node || node.assessmentId !== assessmentId) {
    throw AppError.validation('Syllabus node does not belong to this assessment');
  }
};

export interface StudyItemListQuery {
  page: number;
  pageSize: number;
  search?: string | undefined;
  subject?: string | undefined;
  topic?: string | undefined;
  priority?: string | undefined;
  completed?: boolean | undefined;
  bookmarked?: boolean | undefined;
  dueBefore?: Date | undefined;
  dueAfter?: Date | undefined;
  trackerId?: string | undefined;
  sort: string;
  direction: 'asc' | 'desc';
}

const SORT_FIELD: Record<string, keyof Prisma.StudyItemOrderByWithRelationInput> = {
  NAME: 'name',
  DUE_DATE: 'dueDate',
  PRIORITY: 'priority',
  PLANNED_START: 'plannedStartDate',
  ESTIMATED_MINUTES: 'estimatedMinutes',
  ACTUAL_MINUTES: 'actualMinutes',
  SORT_ORDER: 'sortOrder',
  CREATED_AT: 'createdAt',
};

export const listStudyItems = async (
  userId: string,
  assessmentId: string,
  query: StudyItemListQuery,
) => {
  const assessment = await getAssessmentForUser(userId, assessmentId);
  const { skip, take } = toSkipTake(query);

  const where: Prisma.StudyItemWhereInput = {
    assessmentId,
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
            { topic: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(query.subject ? { subject: query.subject } : {}),
    ...(query.topic ? { topic: query.topic } : {}),
    ...(query.priority ? { priority: query.priority as never } : {}),
    ...(query.completed !== undefined ? { completed: query.completed } : {}),
    ...(query.trackerId ? { trackerId: query.trackerId } : {}),
    ...(query.bookmarked !== undefined
      ? { bookmarks: query.bookmarked ? { some: {} } : { none: {} } }
      : {}),
    ...(query.dueBefore || query.dueAfter
      ? {
          dueDate: {
            ...(query.dueBefore ? { lte: query.dueBefore } : {}),
            ...(query.dueAfter ? { gte: query.dueAfter } : {}),
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.studyItem.findMany({
      where,
      select: ITEM_SELECT,
      orderBy: [{ [SORT_FIELD[query.sort] ?? 'sortOrder']: query.direction }, { id: 'asc' }],
      skip,
      take,
    }),
    prisma.studyItem.count({ where }),
  ]);

  return {
    items: rows.map((row) => toView(row, assessment.timeZone)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
};

export const getStudyItem = async (
  userId: string,
  assessmentId: string,
  itemId: string,
): Promise<StudyItemView> => {
  const assessment = await getAssessmentForUser(userId, assessmentId);
  const row = await prisma.studyItem.findUnique({ where: { id: itemId }, select: ITEM_SELECT });
  if (!row || row.assessmentId !== assessmentId) throw AppError.notFound('Study item');
  return toView(row, assessment.timeZone);
};

export const createStudyItem = async (
  userId: string,
  assessmentId: string,
  input: CreateStudyItemInput,
): Promise<StudyItemView> => {
  const assessment = await getAssessmentForUser(userId, assessmentId);
  await assertTrackerBelongs(assessmentId, input.trackerId);
  await assertSyllabusNodeBelongs(assessmentId, input.syllabusNodeId);
  if (input.customValues?.length) {
    await assertCustomFieldsBelong(assessmentId, input.customValues.map((v) => v.customFieldId));
  }

  const maxOrder = await prisma.studyItem.aggregate({
    where: { assessmentId, trackerId: input.trackerId ?? null },
    _max: { sortOrder: true },
  });

  const created = await prisma.studyItem.create({
    data: {
      assessmentId,
      trackerId: input.trackerId,
      syllabusNodeId: input.syllabusNodeId,
      name: input.name,
      description: input.description,
      subject: input.subject,
      topic: input.topic,
      subtopic: input.subtopic,
      priority: input.priority,
      plannedStartDate: input.plannedStartDate,
      dueDate: input.dueDate,
      estimatedMinutes: input.estimatedMinutes,
      metadata: input.metadata === null ? Prisma.JsonNull : (input.metadata as Prisma.InputJsonValue),
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      ...(input.customValues?.length
        ? {
            customValues: {
              create: input.customValues.map((value) => ({
                customFieldId: value.customFieldId,
                value: value.value,
              })),
            },
          }
        : {}),
    },
    select: ITEM_SELECT,
  });

  return toView(created, assessment.timeZone);
};

/**
 * Updates an item. Note the deliberate behaviour around completion:
 * - marking complete sets completedAt (defaults to now) and is the only way
 *   the item becomes COMPLETED,
 * - marking incomplete clears completedAt,
 * - completing an item does NOT complete its practice attempts, and vice versa.
 */
export const updateStudyItem = async (
  userId: string,
  assessmentId: string,
  itemId: string,
  input: UpdateStudyItemInput,
): Promise<StudyItemView> => {
  const assessment = await getAssessmentForUser(userId, assessmentId);
  const current = await prisma.studyItem.findUnique({
    where: { id: itemId },
    select: {
      assessmentId: true,
      plannedStartDate: true,
      dueDate: true,
      completed: true,
      completedAt: true,
    },
  });
  if (!current || current.assessmentId !== assessmentId) throw AppError.notFound('Study item');

  if ('trackerId' in input) await assertTrackerBelongs(assessmentId, input.trackerId ?? null);
  if ('syllabusNodeId' in input) await assertSyllabusNodeBelongs(assessmentId, input.syllabusNodeId ?? null);
  if (input.customValues?.length) {
    await assertCustomFieldsBelong(assessmentId, input.customValues.map((v) => v.customFieldId));
  }

  const nextStart = 'plannedStartDate' in input ? input.plannedStartDate : current.plannedStartDate;
  const nextDue = 'dueDate' in input ? input.dueDate : current.dueDate;
  if (nextStart && nextDue && nextStart.getTime() > nextDue.getTime()) {
    throw AppError.validation('Planned start must be on or before the due date', [
      { path: 'dueDate', message: 'Due date must be on or after the planned start' },
    ]);
  }

  const completionData = (() => {
    if (input.completed === undefined) {
      // Changing completedAt on its own is allowed only when completed stays true.
      if ('completedAt' in input && current.completed) {
        return { completedAt: input.completedAt ?? null };
      }
      return {};
    }
    if (input.completed) {
      return { completed: true, completedAt: input.completedAt ?? current.completedAt ?? new Date() };
    }
    return { completed: false, completedAt: null };
  })();

  const updated = await prisma.$transaction(async (tx) => {
    if (input.customValues?.length) {
      for (const value of input.customValues) {
        await tx.studyItemCustomValue.upsert({
          where: { studyItemId_customFieldId: { studyItemId: itemId, customFieldId: value.customFieldId } },
          create: { studyItemId: itemId, customFieldId: value.customFieldId, value: value.value },
          update: { value: value.value },
        });
      }
    }

    return tx.studyItem.update({
      where: { id: itemId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...('description' in input ? { description: input.description ?? null } : {}),
        ...('subject' in input ? { subject: input.subject ?? null } : {}),
        ...('topic' in input ? { topic: input.topic ?? null } : {}),
        ...('subtopic' in input ? { subtopic: input.subtopic ?? null } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...('plannedStartDate' in input ? { plannedStartDate: nextStart } : {}),
        ...('dueDate' in input ? { dueDate: nextDue } : {}),
        ...('estimatedMinutes' in input ? { estimatedMinutes: input.estimatedMinutes ?? null } : {}),
        ...('trackerId' in input ? { trackerId: input.trackerId ?? null } : {}),
        ...('syllabusNodeId' in input ? { syllabusNodeId: input.syllabusNodeId ?? null } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...('metadata' in input
          ? { metadata: input.metadata === null ? Prisma.JsonNull : (input.metadata as Prisma.InputJsonValue) }
          : {}),
        ...completionData,
      },
      select: ITEM_SELECT,
    });
  });

  return toView(updated, assessment.timeZone);
};

/**
 * Explicit reschedule. The ONLY path that changes planned dates, and it records
 * the previous values in the item's metadata audit trail so planning accuracy
 * can be evaluated later. It never moves anything by itself.
 */
export const rescheduleStudyItem = async (
  userId: string,
  assessmentId: string,
  itemId: string,
  input: { plannedStartDate: Date | null; dueDate: Date | null; reason: string | null },
): Promise<StudyItemView> => {
  const assessment = await getAssessmentForUser(userId, assessmentId);
  const current = await prisma.studyItem.findUnique({
    where: { id: itemId },
    select: { assessmentId: true, plannedStartDate: true, dueDate: true, metadata: true },
  });
  if (!current || current.assessmentId !== assessmentId) throw AppError.notFound('Study item');

  const metadata =
    current.metadata && typeof current.metadata === 'object' && !Array.isArray(current.metadata)
      ? (current.metadata as Record<string, unknown>)
      : {};
  const history = Array.isArray(metadata.rescheduleHistory) ? (metadata.rescheduleHistory as unknown[]) : [];

  const entry = {
    at: new Date().toISOString(),
    from: {
      plannedStartDate: current.plannedStartDate?.toISOString() ?? null,
      dueDate: current.dueDate?.toISOString() ?? null,
    },
    to: {
      plannedStartDate: input.plannedStartDate?.toISOString() ?? null,
      dueDate: input.dueDate?.toISOString() ?? null,
    },
    reason: input.reason,
  };

  const updated = await prisma.studyItem.update({
    where: { id: itemId },
    data: {
      plannedStartDate: input.plannedStartDate,
      dueDate: input.dueDate,
      metadata: {
        ...metadata,
        // Cap the trail so metadata cannot grow without bound.
        rescheduleHistory: [...history.slice(-49), entry],
      } as Prisma.InputJsonValue,
    },
    select: ITEM_SELECT,
  });

  return toView(updated, assessment.timeZone);
};

export const deleteStudyItem = async (
  userId: string,
  assessmentId: string,
  itemId: string,
): Promise<void> => {
  await getAssessmentForUser(userId, assessmentId);
  const current = await prisma.studyItem.findUnique({
    where: { id: itemId },
    select: { assessmentId: true },
  });
  if (!current || current.assessmentId !== assessmentId) throw AppError.notFound('Study item');
  // Attempts, sessions, bookmarks and custom values cascade with the item.
  await prisma.studyItem.delete({ where: { id: itemId } });
};

export const reorderStudyItems = async (
  userId: string,
  assessmentId: string,
  orderedIds: string[],
): Promise<void> => {
  await getAssessmentForUser(userId, assessmentId);
  const found = await prisma.studyItem.findMany({
    where: { id: { in: orderedIds }, assessmentId },
    select: { id: true },
  });
  if (found.length !== orderedIds.length) {
    throw AppError.validation('One or more items do not belong to this assessment');
  }
  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.studyItem.update({ where: { id }, data: { sortOrder: index } })),
  );
};

// ------------------------- practice attempts --------------------------------

export interface PracticeAttemptView {
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

const attemptToView = (row: {
  id: string;
  studyItemId: string;
  slotIndex: number;
  attemptedAt: Date;
  questionsAttempted: number | null;
  questionsCorrect: number | null;
  marksObtained: number | null;
  maxMarks: number | null;
  durationMinutes: number | null;
  notes: string | null;
}): PracticeAttemptView => ({
  id: row.id,
  studyItemId: row.studyItemId,
  slotIndex: row.slotIndex,
  attemptedAt: row.attemptedAt.toISOString(),
  questionsAttempted: row.questionsAttempted,
  questionsCorrect: row.questionsCorrect,
  marksObtained: row.marksObtained,
  maxMarks: row.maxMarks,
  durationMinutes: row.durationMinutes,
  notes: row.notes,
  accuracy:
    row.questionsAttempted && row.questionsAttempted > 0 && row.questionsCorrect !== null
      ? row.questionsCorrect / row.questionsAttempted
      : null,
  percentage:
    row.maxMarks && row.maxMarks > 0 && row.marksObtained !== null ? row.marksObtained / row.maxMarks : null,
});

const assertItemInAssessment = async (assessmentId: string, itemId: string): Promise<void> => {
  const item = await prisma.studyItem.findUnique({
    where: { id: itemId },
    select: { assessmentId: true },
  });
  if (!item || item.assessmentId !== assessmentId) throw AppError.notFound('Study item');
};

export const listAttempts = async (
  userId: string,
  assessmentId: string,
  itemId: string,
): Promise<PracticeAttemptView[]> => {
  await getAssessmentForUser(userId, assessmentId);
  await assertItemInAssessment(assessmentId, itemId);
  const rows = await prisma.practiceAttempt.findMany({
    where: { studyItemId: itemId },
    orderBy: [{ slotIndex: 'asc' }, { attemptedAt: 'desc' }],
  });
  return rows.map(attemptToView);
};

export const createAttempt = async (
  userId: string,
  assessmentId: string,
  itemId: string,
  input: PracticeAttemptInput,
): Promise<PracticeAttemptView> => {
  await getAssessmentForUser(userId, assessmentId);
  await assertItemInAssessment(assessmentId, itemId);

  const row = await prisma.practiceAttempt.create({
    data: {
      studyItemId: itemId,
      slotIndex: input.slotIndex,
      attemptedAt: input.attemptedAt,
      questionsAttempted: input.questionsAttempted,
      questionsCorrect: input.questionsCorrect,
      marksObtained: input.marksObtained,
      maxMarks: input.maxMarks,
      durationMinutes: input.durationMinutes,
      notes: input.notes,
    },
  });
  return attemptToView(row);
};

export const updateAttempt = async (
  userId: string,
  assessmentId: string,
  itemId: string,
  attemptId: string,
  input: Partial<PracticeAttemptInput>,
): Promise<PracticeAttemptView> => {
  await getAssessmentForUser(userId, assessmentId);
  await assertItemInAssessment(assessmentId, itemId);

  const current = await prisma.practiceAttempt.findUnique({
    where: { id: attemptId },
    select: {
      studyItemId: true,
      questionsAttempted: true,
      questionsCorrect: true,
      marksObtained: true,
      maxMarks: true,
    },
  });
  if (!current || current.studyItemId !== itemId) throw AppError.notFound('Practice attempt');

  const attempted = input.questionsAttempted ?? current.questionsAttempted;
  const correct = input.questionsCorrect ?? current.questionsCorrect;
  if (attempted !== null && attempted !== undefined && correct !== null && correct !== undefined && correct > attempted) {
    throw AppError.validation('Correct answers cannot exceed questions attempted', [
      { path: 'questionsCorrect', message: 'Exceeds questions attempted' },
    ]);
  }
  const maxMarks = input.maxMarks ?? current.maxMarks;
  const obtained = input.marksObtained ?? current.marksObtained;
  if (maxMarks !== null && maxMarks !== undefined && obtained !== null && obtained !== undefined && obtained > maxMarks) {
    throw AppError.validation('Marks obtained cannot exceed maximum marks', [
      { path: 'marksObtained', message: 'Exceeds maximum marks' },
    ]);
  }

  const row = await prisma.practiceAttempt.update({
    where: { id: attemptId },
    data: {
      ...(input.slotIndex !== undefined ? { slotIndex: input.slotIndex } : {}),
      ...(input.attemptedAt !== undefined ? { attemptedAt: input.attemptedAt } : {}),
      ...('questionsAttempted' in input ? { questionsAttempted: input.questionsAttempted ?? null } : {}),
      ...('questionsCorrect' in input ? { questionsCorrect: input.questionsCorrect ?? null } : {}),
      ...('marksObtained' in input ? { marksObtained: input.marksObtained ?? null } : {}),
      ...('maxMarks' in input ? { maxMarks: input.maxMarks ?? null } : {}),
      ...('durationMinutes' in input ? { durationMinutes: input.durationMinutes ?? null } : {}),
      ...('notes' in input ? { notes: input.notes ?? null } : {}),
    },
  });
  return attemptToView(row);
};

export const deleteAttempt = async (
  userId: string,
  assessmentId: string,
  itemId: string,
  attemptId: string,
): Promise<void> => {
  await getAssessmentForUser(userId, assessmentId);
  await assertItemInAssessment(assessmentId, itemId);
  const current = await prisma.practiceAttempt.findUnique({
    where: { id: attemptId },
    select: { studyItemId: true },
  });
  if (!current || current.studyItemId !== itemId) throw AppError.notFound('Practice attempt');
  await prisma.practiceAttempt.delete({ where: { id: attemptId } });
};

/** Used by the scheduler and analytics: items due today in the assessment zone. */
export const itemsDueOn = async (assessmentId: string, day: Date, timeZone: string) => {
  const start = startOfDayInZone(day, timeZone);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return prisma.studyItem.findMany({
    where: { assessmentId, dueDate: { gte: start, lt: end } },
    select: { id: true, name: true, dueDate: true, completed: true },
  });
};
