import type { CreateStudySessionInput, UpdateStudySessionInput } from '@exampilot/shared';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { toSkipTake } from '../../lib/pagination.js';
import { getAssessmentForUser } from '../assessments/assessment.service.js';
import { recomputeActualMinutes, sessionMinutes } from '../studyItems/studyItem.service.js';

export interface StudySessionView {
  id: string;
  assessmentId: string;
  studyItemId: string | null;
  startedAt: string;
  endedAt: string | null;
  manualMinutes: number | null;
  /** Single source of truth for how long this session counted for. */
  effectiveMinutes: number;
  notes: string | null;
  createdAt: string;
}

const toView = (row: {
  id: string;
  assessmentId: string;
  studyItemId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  manualMinutes: number | null;
  notes: string | null;
  createdAt: Date;
}): StudySessionView => ({
  id: row.id,
  assessmentId: row.assessmentId,
  studyItemId: row.studyItemId,
  startedAt: row.startedAt.toISOString(),
  endedAt: row.endedAt?.toISOString() ?? null,
  manualMinutes: row.manualMinutes,
  effectiveMinutes: sessionMinutes(row),
  notes: row.notes,
  createdAt: row.createdAt.toISOString(),
});

const assertItemInAssessment = async (assessmentId: string, itemId: string | null): Promise<void> => {
  if (!itemId) return;
  const item = await prisma.studyItem.findUnique({
    where: { id: itemId },
    select: { assessmentId: true },
  });
  if (!item || item.assessmentId !== assessmentId) {
    throw AppError.validation('Study item does not belong to this assessment');
  }
};

export const listSessions = async (
  userId: string,
  assessmentId: string,
  query: { page: number; pageSize: number; studyItemId?: string; from?: Date; to?: Date },
) => {
  await getAssessmentForUser(userId, assessmentId);
  const { skip, take } = toSkipTake(query);

  const where = {
    assessmentId,
    ...(query.studyItemId ? { studyItemId: query.studyItemId } : {}),
    ...(query.from || query.to
      ? {
          startedAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.studySession.findMany({ where, orderBy: { startedAt: 'desc' }, skip, take }),
    prisma.studySession.count({ where }),
  ]);

  const totalMinutes = rows.reduce((sum, row) => sum + sessionMinutes(row), 0);

  return {
    items: rows.map(toView),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalMinutes,
  };
};

export const createSession = async (
  userId: string,
  assessmentId: string,
  input: CreateStudySessionInput,
): Promise<StudySessionView> => {
  await getAssessmentForUser(userId, assessmentId);
  await assertItemInAssessment(assessmentId, input.studyItemId);

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.studySession.create({
      data: {
        userId,
        assessmentId,
        studyItemId: input.studyItemId,
        // A manual-duration session is anchored to "now" so ordering works.
        startedAt: input.startedAt ?? new Date(),
        endedAt: input.endedAt ?? null,
        manualMinutes: input.manualMinutes ?? null,
        notes: input.notes,
      },
    });
    // Keep the item's denormalised total in step, inside the same transaction.
    if (input.studyItemId) await recomputeActualMinutes(tx, input.studyItemId);
    return created;
  });

  return toView(row);
};

export const updateSession = async (
  userId: string,
  assessmentId: string,
  sessionId: string,
  input: UpdateStudySessionInput,
): Promise<StudySessionView> => {
  await getAssessmentForUser(userId, assessmentId);

  const current = await prisma.studySession.findUnique({
    where: { id: sessionId },
    select: {
      assessmentId: true,
      studyItemId: true,
      startedAt: true,
      endedAt: true,
      manualMinutes: true,
    },
  });
  if (!current || current.assessmentId !== assessmentId) throw AppError.notFound('Study session');

  const nextStart = 'startedAt' in input ? (input.startedAt ?? current.startedAt) : current.startedAt;
  const nextEnd = 'endedAt' in input ? (input.endedAt ?? null) : current.endedAt;
  const nextManual = 'manualMinutes' in input ? (input.manualMinutes ?? null) : current.manualMinutes;

  if (nextManual !== null && nextManual !== undefined && nextEnd) {
    throw AppError.validation('Provide either a start/end pair or manualMinutes, not both', [
      { path: 'manualMinutes', message: 'Cannot combine with endedAt' },
    ]);
  }
  if (nextEnd && nextEnd.getTime() <= nextStart.getTime()) {
    throw AppError.validation('Session end must be after its start', [
      { path: 'endedAt', message: 'Must be after startedAt' },
    ]);
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.studySession.update({
      where: { id: sessionId },
      data: {
        ...('startedAt' in input ? { startedAt: nextStart } : {}),
        ...('endedAt' in input ? { endedAt: nextEnd } : {}),
        ...('manualMinutes' in input ? { manualMinutes: nextManual } : {}),
        ...('notes' in input ? { notes: input.notes ?? null } : {}),
      },
    });
    if (current.studyItemId) await recomputeActualMinutes(tx, current.studyItemId);
    return updated;
  });

  return toView(row);
};

export const deleteSession = async (
  userId: string,
  assessmentId: string,
  sessionId: string,
): Promise<void> => {
  await getAssessmentForUser(userId, assessmentId);
  const current = await prisma.studySession.findUnique({
    where: { id: sessionId },
    select: { assessmentId: true, studyItemId: true },
  });
  if (!current || current.assessmentId !== assessmentId) throw AppError.notFound('Study session');

  await prisma.$transaction(async (tx) => {
    await tx.studySession.delete({ where: { id: sessionId } });
    if (current.studyItemId) await recomputeActualMinutes(tx, current.studyItemId);
  });
};
