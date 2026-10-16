import { Prisma } from '@prisma/client';
import type { CreateMockTestInput, UpdateMockTestInput } from '@exampilot/shared';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { toSkipTake } from '../../lib/pagination.js';
import { getAssessmentForUser } from '../assessments/assessment.service.js';

export interface MockTestSection {
  name: string;
  totalMarks: number;
  marksObtained: number;
  notes?: string | null;
}

export interface MockTestView {
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
  /** Id of this record's bookmark, so clients can remove it without searching the list. */
  bookmarkId: string | null;
}

const MOCK_SELECT = {
  id: true,
  assessmentId: true,
  name: true,
  takenOn: true,
  totalMarks: true,
  marksObtained: true,
  durationMinutes: true,
  sections: true,
  notes: true,
  reviewed: true,
  createdAt: true,
  updatedAt: true,
  bookmarks: { select: { id: true }, take: 1 },
  _count: { select: { bookmarks: true } },
} as const;

const percentageOf = (obtained: number, total: number): number =>
  total > 0 ? Math.round((obtained / total) * 10000) / 100 : 0;

const toView = (row: {
  id: string;
  assessmentId: string;
  name: string;
  takenOn: Date;
  totalMarks: number;
  marksObtained: number;
  durationMinutes: number | null;
  sections: Prisma.JsonValue;
  notes: string | null;
  reviewed: boolean;
  createdAt: Date;
  updatedAt: Date;
  bookmarks: Array<{ id: string }>;
  _count: { bookmarks: number };
}): MockTestView => ({
  id: row.id,
  assessmentId: row.assessmentId,
  name: row.name,
  takenOn: row.takenOn.toISOString(),
  totalMarks: row.totalMarks,
  marksObtained: row.marksObtained,
  percentage: percentageOf(row.marksObtained, row.totalMarks),
  durationMinutes: row.durationMinutes,
  sections: Array.isArray(row.sections) ? (row.sections as unknown as MockTestSection[]) : null,
  notes: row.notes,
  reviewed: row.reviewed,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  isBookmarked: row._count.bookmarks > 0,
  bookmarkId: row.bookmarks[0]?.id ?? null,
});

export const listMockTests = async (
  userId: string,
  assessmentId: string,
  query: { page: number; pageSize: number; from?: Date; to?: Date },
) => {
  await getAssessmentForUser(userId, assessmentId);
  const { skip, take } = toSkipTake(query);

  const where = {
    userId,
    assessmentId,
    ...(query.from || query.to
      ? {
          takenOn: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.mockTest.findMany({ where, select: MOCK_SELECT, orderBy: { takenOn: 'desc' }, skip, take }),
    prisma.mockTest.count({ where }),
  ]);

  return { items: rows.map(toView), total, page: query.page, pageSize: query.pageSize };
};

export const getMockTest = async (
  userId: string,
  assessmentId: string,
  testId: string,
): Promise<MockTestView> => {
  await getAssessmentForUser(userId, assessmentId);
  const row = await prisma.mockTest.findUnique({ where: { id: testId }, select: MOCK_SELECT });
  if (!row || row.assessmentId !== assessmentId) throw AppError.notFound('Mock test');
  const owned = await prisma.mockTest.findUnique({ where: { id: testId }, select: { userId: true } });
  if (!owned || owned.userId !== userId) throw AppError.notFound('Mock test');
  return toView(row);
};

export const createMockTest = async (
  userId: string,
  assessmentId: string,
  input: CreateMockTestInput,
): Promise<MockTestView> => {
  await getAssessmentForUser(userId, assessmentId);

  const row = await prisma.mockTest.create({
    data: {
      userId,
      assessmentId,
      name: input.name,
      takenOn: input.takenOn,
      totalMarks: input.totalMarks,
      marksObtained: input.marksObtained,
      durationMinutes: input.durationMinutes,
      sections: (input.sections ?? undefined) as Prisma.InputJsonValue | undefined,
      notes: input.notes,
      reviewed: input.reviewed,
    },
    select: MOCK_SELECT,
  });
  return toView(row);
};

export const updateMockTest = async (
  userId: string,
  assessmentId: string,
  testId: string,
  input: UpdateMockTestInput,
): Promise<MockTestView> => {
  await getAssessmentForUser(userId, assessmentId);
  const current = await prisma.mockTest.findUnique({
    where: { id: testId },
    select: { assessmentId: true, userId: true, totalMarks: true, marksObtained: true },
  });
  if (!current || current.assessmentId !== assessmentId || current.userId !== userId) {
    throw AppError.notFound('Mock test');
  }

  const total = input.totalMarks ?? current.totalMarks;
  const obtained = input.marksObtained ?? current.marksObtained;
  if (obtained > total) {
    throw AppError.validation('Marks obtained cannot exceed total marks', [
      { path: 'marksObtained', message: 'Exceeds total marks' },
    ]);
  }

  const badSection = input.sections?.find((section) => section.marksObtained > section.totalMarks);
  if (badSection) {
    throw AppError.validation('A section cannot score more than its total marks', [
      { path: 'sections', message: `"${badSection.name}" exceeds its total marks` },
    ]);
  }

  const row = await prisma.mockTest.update({
    where: { id: testId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.takenOn !== undefined ? { takenOn: input.takenOn } : {}),
      ...(input.totalMarks !== undefined ? { totalMarks: input.totalMarks } : {}),
      ...(input.marksObtained !== undefined ? { marksObtained: input.marksObtained } : {}),
      ...('durationMinutes' in input ? { durationMinutes: input.durationMinutes ?? null } : {}),
      ...('sections' in input
        ? { sections: input.sections === null ? Prisma.JsonNull : (input.sections as Prisma.InputJsonValue) }
        : {}),
      ...('notes' in input ? { notes: input.notes ?? null } : {}),
      ...(input.reviewed !== undefined ? { reviewed: input.reviewed } : {}),
    },
    select: MOCK_SELECT,
  });
  return toView(row);
};

export const deleteMockTest = async (
  userId: string,
  assessmentId: string,
  testId: string,
): Promise<void> => {
  await getAssessmentForUser(userId, assessmentId);
  const current = await prisma.mockTest.findUnique({
    where: { id: testId },
    select: { assessmentId: true, userId: true },
  });
  if (!current || current.assessmentId !== assessmentId || current.userId !== userId) {
    throw AppError.notFound('Mock test');
  }
  await prisma.mockTest.delete({ where: { id: testId } });
};

/** Trend data computed from recorded results only. No synthetic values. */
export const mockTestSummary = async (userId: string, assessmentId: string) => {
  await getAssessmentForUser(userId, assessmentId);
  const tests = await prisma.mockTest.findMany({
    where: { userId, assessmentId },
    select: { id: true, name: true, takenOn: true, totalMarks: true, marksObtained: true },
    orderBy: { takenOn: 'asc' },
  });

  if (tests.length === 0) {
    return { count: 0, averagePercentage: null, bestPercentage: null, latestPercentage: null, trend: [] as Array<{ id: string; name: string; takenOn: string; percentage: number }> };
  }

  const trend = tests.map((test) => ({
    id: test.id,
    name: test.name,
    takenOn: test.takenOn.toISOString(),
    percentage: percentageOf(test.marksObtained, test.totalMarks),
  }));
  const values = trend.map((point) => point.percentage);

  return {
    count: tests.length,
    averagePercentage: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
    bestPercentage: Math.max(...values),
    latestPercentage: values[values.length - 1] ?? null,
    trend,
  };
};
