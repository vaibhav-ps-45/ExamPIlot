import type { CreateNoteInput, UpdateNoteInput } from '@exampilot/shared';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { toSkipTake } from '../../lib/pagination.js';
import { getAssessmentForUser } from '../assessments/assessment.service.js';

export interface NoteView {
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
  /** Id of this record's bookmark, so clients can remove it without searching the list. */
  bookmarkId: string | null;
  excerpt: string;
}

const NOTE_SELECT = {
  id: true,
  assessmentId: true,
  studyItemId: true,
  syllabusNodeId: true,
  title: true,
  body: true,
  pinned: true,
  createdAt: true,
  updatedAt: true,
  bookmarks: { select: { id: true }, take: 1 },
  _count: { select: { bookmarks: true } },
} as const;

const toView = (row: {
  id: string;
  assessmentId: string;
  studyItemId: string | null;
  syllabusNodeId: string | null;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  bookmarks: Array<{ id: string }>;
  _count: { bookmarks: number };
}): NoteView => ({
  id: row.id,
  assessmentId: row.assessmentId,
  studyItemId: row.studyItemId,
  syllabusNodeId: row.syllabusNodeId,
  title: row.title,
  body: row.body,
  pinned: row.pinned,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  isBookmarked: row._count.bookmarks > 0,
  bookmarkId: row.bookmarks[0]?.id ?? null,
  excerpt: row.body.slice(0, 160),
});

const assertLinksBelong = async (
  assessmentId: string,
  studyItemId: string | null,
  syllabusNodeId: string | null,
): Promise<void> => {
  if (studyItemId) {
    const item = await prisma.studyItem.findUnique({
      where: { id: studyItemId },
      select: { assessmentId: true },
    });
    if (!item || item.assessmentId !== assessmentId) {
      throw AppError.validation('Study item does not belong to this assessment');
    }
  }
  if (syllabusNodeId) {
    const node = await prisma.syllabusNode.findUnique({
      where: { id: syllabusNodeId },
      select: { assessmentId: true },
    });
    if (!node || node.assessmentId !== assessmentId) {
      throw AppError.validation('Syllabus node does not belong to this assessment');
    }
  }
};

export const listNotes = async (
  userId: string,
  assessmentId: string,
  query: { page: number; pageSize: number; search?: string | null; studyItemId?: string; pinned?: boolean },
) => {
  await getAssessmentForUser(userId, assessmentId);
  const { skip, take } = toSkipTake(query);

  const where = {
    userId,
    assessmentId,
    ...(query.studyItemId ? { studyItemId: query.studyItemId } : {}),
    ...(query.pinned !== undefined ? { pinned: query.pinned } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' as const } },
            { body: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.note.findMany({
      where,
      select: NOTE_SELECT,
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      skip,
      take,
    }),
    prisma.note.count({ where }),
  ]);

  return { items: rows.map(toView), total, page: query.page, pageSize: query.pageSize };
};

export const getNote = async (userId: string, assessmentId: string, noteId: string): Promise<NoteView> => {
  await getAssessmentForUser(userId, assessmentId);
  const row = await prisma.note.findUnique({ where: { id: noteId }, select: NOTE_SELECT });
  if (!row || row.assessmentId !== assessmentId) throw AppError.notFound('Note');
  const owned = await prisma.note.findUnique({ where: { id: noteId }, select: { userId: true } });
  if (!owned || owned.userId !== userId) throw AppError.notFound('Note');
  return toView(row);
};

export const createNote = async (
  userId: string,
  assessmentId: string,
  input: CreateNoteInput,
): Promise<NoteView> => {
  await getAssessmentForUser(userId, assessmentId);
  await assertLinksBelong(assessmentId, input.studyItemId, input.syllabusNodeId);

  const row = await prisma.note.create({
    data: {
      userId,
      assessmentId,
      studyItemId: input.studyItemId,
      syllabusNodeId: input.syllabusNodeId,
      title: input.title,
      body: input.body,
      pinned: input.pinned,
    },
    select: NOTE_SELECT,
  });
  return toView(row);
};

export const updateNote = async (
  userId: string,
  assessmentId: string,
  noteId: string,
  input: UpdateNoteInput,
): Promise<NoteView> => {
  await getAssessmentForUser(userId, assessmentId);
  const current = await prisma.note.findUnique({
    where: { id: noteId },
    select: { assessmentId: true, userId: true, studyItemId: true, syllabusNodeId: true },
  });
  if (!current || current.assessmentId !== assessmentId || current.userId !== userId) {
    throw AppError.notFound('Note');
  }

  const nextItem = 'studyItemId' in input ? (input.studyItemId ?? null) : current.studyItemId;
  const nextNode = 'syllabusNodeId' in input ? (input.syllabusNodeId ?? null) : current.syllabusNodeId;
  await assertLinksBelong(assessmentId, nextItem, nextNode);

  const row = await prisma.note.update({
    where: { id: noteId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
      ...('studyItemId' in input ? { studyItemId: nextItem } : {}),
      ...('syllabusNodeId' in input ? { syllabusNodeId: nextNode } : {}),
    },
    select: NOTE_SELECT,
  });
  return toView(row);
};

export const deleteNote = async (
  userId: string,
  assessmentId: string,
  noteId: string,
): Promise<void> => {
  await getAssessmentForUser(userId, assessmentId);
  const current = await prisma.note.findUnique({
    where: { id: noteId },
    select: { assessmentId: true, userId: true },
  });
  if (!current || current.assessmentId !== assessmentId || current.userId !== userId) {
    throw AppError.notFound('Note');
  }
  await prisma.note.delete({ where: { id: noteId } });
};
