import type {
  AssessmentSchedulePreferenceInput,
  CreateAssessmentInput,
  UpdateAssessmentInput,
} from '@exampilot/shared';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { daysUntil } from '../../lib/dates.js';

export interface AssessmentView {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  startDate: string | null;
  examDate: string | null;
  timeZone: string;
  status: string;
  accentColor: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Derived, never stored. null when the assessment has no exam date. */
  daysUntilExam: number | null;
  /** True when the exam date is in the past but the assessment is not completed. */
  examDatePassed: boolean;
  schedulePreference: {
    preferredStudyDays: number[];
    dailyTargetMinutes: number | null;
    trackScheduleAdherence: boolean;
  } | null;
}

type AssessmentRow = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  startDate: Date | null;
  examDate: Date | null;
  timeZone: string;
  status: string;
  accentColor: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  schedulePref: {
    preferredStudyDays: number[];
    dailyTargetMinutes: number | null;
    trackScheduleAdherence: boolean;
  } | null;
};

const toView = (row: AssessmentRow, now: Date = new Date()): AssessmentView => ({
  id: row.id,
  name: row.name,
  category: row.category,
  description: row.description,
  startDate: row.startDate?.toISOString() ?? null,
  examDate: row.examDate?.toISOString() ?? null,
  timeZone: row.timeZone,
  status: row.status,
  accentColor: row.accentColor,
  archivedAt: row.archivedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  daysUntilExam: row.examDate ? daysUntil(row.examDate, row.timeZone, now) : null,
  examDatePassed: row.examDate ? row.examDate.getTime() < now.getTime() : false,
  schedulePreference: row.schedulePref
    ? {
        preferredStudyDays: row.schedulePref.preferredStudyDays,
        dailyTargetMinutes: row.schedulePref.dailyTargetMinutes,
        trackScheduleAdherence: row.schedulePref.trackScheduleAdherence,
      }
    : null,
});

const SELECT = {
  id: true,
  name: true,
  category: true,
  description: true,
  startDate: true,
  examDate: true,
  timeZone: true,
  status: true,
  accentColor: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  schedulePref: {
    select: { preferredStudyDays: true, dailyTargetMinutes: true, trackScheduleAdherence: true },
  },
} as const;

export const listAssessments = async (
  userId: string,
  query: { status?: string; includeArchived: boolean; search?: string },
): Promise<AssessmentView[]> => {
  const rows = await prisma.assessment.findMany({
    where: {
      userId,
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.includeArchived ? {} : { archivedAt: null }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { category: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: SELECT,
    orderBy: [{ archivedAt: 'asc' }, { examDate: 'asc' }, { createdAt: 'desc' }],
  });
  return rows.map((row) => toView(row));
};

/**
 * Fetch an assessment the caller owns. Returns 404 (not 403) for someone
 * else's id so the API never confirms that another user's row exists.
 */
export const getAssessmentForUser = async (userId: string, assessmentId: string) => {
  const row = await prisma.assessment.findUnique({ where: { id: assessmentId }, select: { ...SELECT, userId: true } });
  if (!row || row.userId !== userId) throw AppError.notFound('Assessment');
  return row;
};

export const getAssessment = async (userId: string, assessmentId: string): Promise<AssessmentView> =>
  toView(await getAssessmentForUser(userId, assessmentId));

export const createAssessment = async (
  userId: string,
  input: CreateAssessmentInput,
): Promise<AssessmentView> => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timeZone: true } });
  if (!user) throw AppError.unauthenticated();

  const row = await prisma.assessment.create({
    data: {
      userId,
      name: input.name,
      category: input.category,
      description: input.description,
      startDate: input.startDate,
      examDate: input.examDate,
      // Fall back to the user's own zone when the client omits one.
      timeZone: input.timeZone || user.timeZone,
      status: input.status,
      accentColor: input.accentColor,
      schedulePref: { create: {} },
    },
    select: SELECT,
  });
  return toView(row);
};

/**
 * Update merges the patch with the stored row before validating the date range,
 * so a partial update can never leave start > exam.
 */
export const updateAssessment = async (
  userId: string,
  assessmentId: string,
  input: UpdateAssessmentInput,
): Promise<AssessmentView> => {
  const current = await getAssessmentForUser(userId, assessmentId);

  const nextStart = 'startDate' in input ? input.startDate : current.startDate;
  const nextExam = 'examDate' in input ? input.examDate : current.examDate;

  if (nextStart && nextExam && nextStart.getTime() > nextExam.getTime()) {
    throw AppError.validation('Start date must be on or before the exam date', [
      { path: 'examDate', message: 'Exam date must be on or after the start date' },
    ]);
  }

  const archived = input.archived;

  const row = await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...('category' in input ? { category: input.category ?? null } : {}),
      ...('description' in input ? { description: input.description ?? null } : {}),
      ...('startDate' in input ? { startDate: nextStart } : {}),
      ...('examDate' in input ? { examDate: nextExam } : {}),
      ...(input.timeZone !== undefined ? { timeZone: input.timeZone } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...('accentColor' in input ? { accentColor: input.accentColor ?? null } : {}),
      ...(archived !== undefined
        ? {
            archivedAt: archived ? (current.archivedAt ?? new Date()) : null,
            ...(archived && current.status !== 'ARCHIVED' ? { status: 'ARCHIVED' as const } : {}),
          }
        : {}),
    },
    select: SELECT,
  });
  return toView(row);
};

export const deleteAssessment = async (userId: string, assessmentId: string): Promise<void> => {
  await getAssessmentForUser(userId, assessmentId);
  // All dependent rows cascade from the schema; nothing is orphaned.
  await prisma.assessment.delete({ where: { id: assessmentId } });
};

export const updateSchedulePreference = async (
  userId: string,
  assessmentId: string,
  input: AssessmentSchedulePreferenceInput,
): Promise<AssessmentView> => {
  await getAssessmentForUser(userId, assessmentId);
  await prisma.assessmentSchedulePreference.upsert({
    where: { assessmentId },
    create: { assessmentId, ...input },
    update: { ...input },
  });
  return getAssessment(userId, assessmentId);
};
