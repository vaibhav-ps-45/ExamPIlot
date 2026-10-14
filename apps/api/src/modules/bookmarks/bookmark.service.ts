import { Prisma } from '@prisma/client';
import type { CreateBookmarkInput, UpdateBookmarkInput } from '@exampilot/shared';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { toSkipTake } from '../../lib/pagination.js';

export interface BookmarkView {
  id: string;
  targetType: string;
  targetId: string;
  label: string;
  customLabel: string | null;
  reason: string | null;
  createdAt: string;
  assessmentId: string | null;
  /** Enough context to render the saved item without a second request. */
  title: string;
  subtitle: string | null;
  subject: string | null;
  dueDate: string | null;
  completed: boolean | null;
  /** Where to navigate to open the item in its original context. */
  contextPath: string;
}

type BookmarkRow = Prisma.BookmarkGetPayload<{
  include: {
    studyItem: { select: { id: true; name: true; subject: true; dueDate: true; completed: true; assessmentId: true } };
    syllabusNode: { select: { id: true; title: true; assessmentId: true } };
    note: { select: { id: true; title: true; assessmentId: true } };
    mockTest: { select: { id: true; name: true; assessmentId: true } };
  };
}>;

const BOOKMARK_INCLUDE = {
  studyItem: {
    select: { id: true, name: true, subject: true, dueDate: true, completed: true, assessmentId: true },
  },
  syllabusNode: { select: { id: true, title: true, assessmentId: true } },
  note: { select: { id: true, title: true, assessmentId: true } },
  mockTest: { select: { id: true, name: true, assessmentId: true } },
} satisfies Prisma.BookmarkInclude;

const toView = (row: BookmarkRow): BookmarkView => {
  const base = {
    id: row.id,
    targetType: row.targetType,
    label: row.label,
    customLabel: row.customLabel,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };

  if (row.studyItem) {
    return {
      ...base,
      targetId: row.studyItem.id,
      assessmentId: row.studyItem.assessmentId,
      title: row.studyItem.name,
      subtitle: 'Study item',
      subject: row.studyItem.subject,
      dueDate: row.studyItem.dueDate?.toISOString() ?? null,
      completed: row.studyItem.completed,
      contextPath: `/assessments/${row.studyItem.assessmentId}/trackers?item=${row.studyItem.id}`,
    };
  }
  if (row.syllabusNode) {
    return {
      ...base,
      targetId: row.syllabusNode.id,
      assessmentId: row.syllabusNode.assessmentId,
      title: row.syllabusNode.title,
      subtitle: 'Syllabus topic',
      subject: null,
      dueDate: null,
      completed: null,
      contextPath: `/assessments/${row.syllabusNode.assessmentId}/syllabus?node=${row.syllabusNode.id}`,
    };
  }
  if (row.note) {
    return {
      ...base,
      targetId: row.note.id,
      assessmentId: row.note.assessmentId,
      title: row.note.title,
      subtitle: 'Note',
      subject: null,
      dueDate: null,
      completed: null,
      contextPath: `/assessments/${row.note.assessmentId}/notes?note=${row.note.id}`,
    };
  }
  if (row.mockTest) {
    return {
      ...base,
      targetId: row.mockTest.id,
      assessmentId: row.mockTest.assessmentId,
      title: row.mockTest.name,
      subtitle: 'Mock test',
      subject: null,
      dueDate: null,
      completed: null,
      contextPath: `/assessments/${row.mockTest.assessmentId}/mock-tests?test=${row.mockTest.id}`,
    };
  }
  // A bookmark whose target was deleted should not exist (FK cascade), but be defensive.
  throw AppError.notFound('Bookmark target');
};

/**
 * Verifies the target belongs to the caller. Ownership is checked through the
 * assessment chain, so a user can never bookmark someone else's item even by
 * guessing an id.
 */
const resolveTarget = async (
  userId: string,
  input: CreateBookmarkInput,
): Promise<Omit<Prisma.BookmarkUncheckedCreateInput, 'targetType'>> => {
  if (input.targetType === 'STUDY_ITEM' && input.studyItemId) {
    const item = await prisma.studyItem.findUnique({
      where: { id: input.studyItemId },
      select: { id: true, assessment: { select: { userId: true } } },
    });
    if (!item || item.assessment.userId !== userId) throw AppError.notFound('Study item');
    return { userId, studyItemId: item.id };
  }
  if (input.targetType === 'SYLLABUS_TOPIC' && input.syllabusNodeId) {
    const node = await prisma.syllabusNode.findUnique({
      where: { id: input.syllabusNodeId },
      select: { id: true, assessment: { select: { userId: true } } },
    });
    if (!node || node.assessment.userId !== userId) throw AppError.notFound('Syllabus topic');
    return { userId, syllabusNodeId: node.id };
  }
  if (input.targetType === 'NOTE' && input.noteId) {
    const note = await prisma.note.findUnique({
      where: { id: input.noteId },
      select: { id: true, userId: true },
    });
    if (!note || note.userId !== userId) throw AppError.notFound('Note');
    return { userId, noteId: note.id };
  }
  if (input.targetType === 'MOCK_TEST' && input.mockTestId) {
    const test = await prisma.mockTest.findUnique({
      where: { id: input.mockTestId },
      select: { id: true, userId: true },
    });
    if (!test || test.userId !== userId) throw AppError.notFound('Mock test');
    return { userId, mockTestId: test.id };
  }
  throw AppError.validation('Bookmark target does not match its type');
};

/**
 * Idempotent by design: bookmarking twice returns the existing bookmark rather
 * than failing, so a double-click in any layout cannot produce duplicates.
 */
export const createBookmark = async (userId: string, input: CreateBookmarkInput): Promise<BookmarkView> => {
  const target = await resolveTarget(userId, input);

  const where = {
    userId,
    ...(target.studyItemId ? { studyItemId: target.studyItemId } : {}),
    ...(target.syllabusNodeId ? { syllabusNodeId: target.syllabusNodeId } : {}),
    ...(target.noteId ? { noteId: target.noteId } : {}),
    ...(target.mockTestId ? { mockTestId: target.mockTestId } : {}),
  };

  const existing = await prisma.bookmark.findFirst({ where, include: BOOKMARK_INCLUDE });
  if (existing) return toView(existing);

  const created = await prisma.bookmark.create({
    data: {
      ...target,
      targetType: input.targetType,
      label: input.label,
      customLabel: input.customLabel,
      reason: input.reason,
    },
    include: BOOKMARK_INCLUDE,
  });

  return toView(created);
};

export const listBookmarks = async (
  userId: string,
  query: {
    page: number;
    pageSize: number;
    assessmentId?: string;
    subject?: string;
    targetType?: string;
    label?: string;
  },
) => {
  const { skip, take } = toSkipTake(query);

  const where: Prisma.BookmarkWhereInput = {
    userId,
    ...(query.targetType ? { targetType: query.targetType as never } : {}),
    ...(query.label ? { label: query.label as never } : {}),
    ...(query.assessmentId
      ? {
          OR: [
            { studyItem: { assessmentId: query.assessmentId } },
            { syllabusNode: { assessmentId: query.assessmentId } },
            { note: { assessmentId: query.assessmentId } },
            { mockTest: { assessmentId: query.assessmentId } },
          ],
        }
      : {}),
    ...(query.subject ? { studyItem: { subject: query.subject } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.bookmark.findMany({
      where,
      include: BOOKMARK_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.bookmark.count({ where }),
  ]);

  return { items: rows.map(toView), total, page: query.page, pageSize: query.pageSize };
};

export const updateBookmark = async (
  userId: string,
  bookmarkId: string,
  input: UpdateBookmarkInput,
): Promise<BookmarkView> => {
  const current = await prisma.bookmark.findUnique({
    where: { id: bookmarkId },
    select: { userId: true },
  });
  if (!current || current.userId !== userId) throw AppError.notFound('Bookmark');

  const updated = await prisma.bookmark.update({
    where: { id: bookmarkId },
    data: {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...('customLabel' in input ? { customLabel: input.customLabel ?? null } : {}),
      ...('reason' in input ? { reason: input.reason ?? null } : {}),
    },
    include: BOOKMARK_INCLUDE,
  });
  return toView(updated);
};

/** Removes the bookmark only. The underlying item is never touched. */
export const deleteBookmark = async (userId: string, bookmarkId: string): Promise<void> => {
  const current = await prisma.bookmark.findUnique({
    where: { id: bookmarkId },
    select: { userId: true },
  });
  if (!current || current.userId !== userId) throw AppError.notFound('Bookmark');
  await prisma.bookmark.delete({ where: { id: bookmarkId } });
};

/** Used by tracker layouts to show bookmark state on each row. */
export const bookmarkedItemIds = async (userId: string, itemIds: string[]): Promise<Set<string>> => {
  if (itemIds.length === 0) return new Set();
  const rows = await prisma.bookmark.findMany({
    where: { userId, studyItemId: { in: itemIds } },
    select: { studyItemId: true },
  });
  return new Set(rows.map((row) => row.studyItemId).filter((id): id is string => Boolean(id)));
};
