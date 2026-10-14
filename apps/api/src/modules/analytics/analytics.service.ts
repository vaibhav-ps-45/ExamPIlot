import { prisma } from '../../lib/prisma.js';
import { calendarDaysBetween, startOfDayInZone } from '../../lib/dates.js';
import { sessionMinutes } from '../studyItems/studyItem.service.js';
import { getAssessmentForUser } from '../assessments/assessment.service.js';

/**
 * Analytics are computed from stored rows only. There are no sample or
 * placeholder statistics: an empty assessment returns zeros and nulls, and the
 * client renders an empty state.
 *
 * Metric definitions (surfaced in the UI so numbers are explainable):
 * - completionPercentage = completed items / total items (items, not minutes).
 * - estimatedMinutes      = sum of StudyItem.estimatedMinutes.
 * - actualMinutes         = sum of session durations (never double counted).
 * - scheduleAdherence     = completed-on-time / items whose due date has passed.
 */

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
    /** Sum of days by which late items slipped. Descriptive, never auto-fixed. */
    totalSlippageDays: number;
  };
  bookmarksByLabel: Array<{ label: string; count: number }>;
  mockTests: {
    count: number;
    averagePercentage: number | null;
    bestPercentage: number | null;
    latestPercentage: number | null;
    trend: Array<{ id: string; name: string; takenOn: string; percentage: number }>;
  };
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

const percentageOf = (obtained: number, total: number): number =>
  total > 0 ? Math.round((obtained / total) * 10000) / 100 : 0;

export const assessmentAnalytics = async (
  userId: string,
  assessmentId: string,
  now: Date = new Date(),
): Promise<AssessmentAnalytics> => {
  const assessment = await getAssessmentForUser(userId, assessmentId);
  const timeZone = assessment.timeZone;

  const [
    items,
    syllabusNodeCount,
    subjectGroups,
    bookmarksByLabel,
    sessionRows,
    mockTests,
    noteCount,
    attemptCount,
  ] = await Promise.all([
    prisma.studyItem.findMany({
      where: { assessmentId },
      select: {
        id: true,
        name: true,
        subject: true,
        dueDate: true,
        completed: true,
        completedAt: true,
        estimatedMinutes: true,
        _count: { select: { bookmarks: true } },
      },
    }),
    prisma.syllabusNode.count({ where: { assessmentId } }),
    prisma.studyItem.findMany({
      where: { assessmentId, subject: { not: null } },
      select: { subject: true },
      distinct: ['subject'],
    }),
    prisma.bookmark.groupBy({
      by: ['label'],
      where: {
        userId,
        OR: [
          { studyItem: { assessmentId } },
          { syllabusNode: { assessmentId } },
          { note: { assessmentId } },
          { mockTest: { assessmentId } },
        ],
      },
      _count: { _all: true },
    }),
    prisma.studySession.findMany({
      where: { assessmentId },
      select: {
        id: true,
        studyItemId: true,
        startedAt: true,
        endedAt: true,
        manualMinutes: true,
        notes: true,
        studyItem: { select: { name: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 10,
    }),
    prisma.mockTest.findMany({
      where: { userId, assessmentId },
      select: { id: true, name: true, takenOn: true, totalMarks: true, marksObtained: true },
      orderBy: { takenOn: 'asc' },
    }),
    prisma.note.count({ where: { userId, assessmentId } }),
    prisma.practiceAttempt.count({ where: { studyItem: { assessmentId } } }),
  ]);

  const totalItems = items.length;
  const completedItems = items.filter((item) => item.completed).length;

  const estimatedMinutes = items.reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0);
  const remainingEstimatedMinutes = items
    .filter((item) => !item.completed)
    .reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0);
  const actualMinutes = sessionRowsAllMinutes(
    await prisma.studySession.findMany({
      where: { assessmentId },
      select: { startedAt: true, endedAt: true, manualMinutes: true },
    }),
  );

  const today = startOfDayInZone(now, timeZone);

  let dueToday = 0;
  let upcoming = 0;
  let overdue = 0;
  let noDate = 0;
  let completedOnTime = 0;
  let completedLate = 0;
  let totalSlippageDays = 0;

  for (const item of items) {
    if (!item.dueDate) {
      noDate += 1;
      continue;
    }
    const days = calendarDaysBetween(now, item.dueDate, timeZone);

    if (item.completed && item.completedAt) {
      const completedDays = calendarDaysBetween(item.dueDate, item.completedAt, timeZone);
      if (completedDays >= 0) completedOnTime += 1;
      else {
        completedLate += 1;
        totalSlippageDays += Math.abs(completedDays);
      }
      continue;
    }

    if (days < 0) overdue += 1;
    else if (days === 0) dueToday += 1;
    else upcoming += 1;
  }

  const judged = completedOnTime + completedLate;
  const mockTrend = mockTests.map((test) => ({
    id: test.id,
    name: test.name,
    takenOn: test.takenOn.toISOString(),
    percentage: percentageOf(test.marksObtained, test.totalMarks),
  }));

  const upcomingDeadlines = items
    .filter((item) => item.dueDate && !item.completed)
    .map((item) => ({
      id: item.id,
      name: item.name,
      subject: item.subject,
      dueDate: item.dueDate!.toISOString(),
      daysUntilDue: calendarDaysBetween(now, item.dueDate!, timeZone),
      isOverdue: item.dueDate!.getTime() < today.getTime(),
      completed: item.completed,
    }))
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    .slice(0, 10);

  return {
    assessmentId,
    daysUntilExam: assessment.examDate ? calendarDaysBetween(now, assessment.examDate, timeZone) : null,
    totals: {
      items: totalItems,
      completedItems,
      completionPercentage: percentageOf(completedItems, totalItems),
      subjects: subjectGroups.length,
      syllabusNodes: syllabusNodeCount,
      bookmarkedItems: items.filter((item) => item._count.bookmarks > 0).length,
      attemptsRecorded: attemptCount,
      notes: noteCount,
    },
    time: {
      estimatedMinutes,
      actualMinutes,
      remainingEstimatedMinutes,
      sessionCount: sessionRows.length,
      plannedVsActualRatio:
        estimatedMinutes > 0 ? Math.round((actualMinutes / estimatedMinutes) * 100) / 100 : null,
    },
    schedule: {
      dueToday,
      upcoming,
      overdue,
      noDate,
      completedOnTime,
      completedLate,
      adherencePercentage: judged > 0 ? percentageOf(completedOnTime, judged) : null,
      totalSlippageDays,
    },
    bookmarksByLabel: bookmarksByLabel.map((row) => ({ label: row.label, count: row._count._all })),
    mockTests: {
      count: mockTests.length,
      averagePercentage: mockTrend.length
        ? Math.round((mockTrend.reduce((sum, point) => sum + point.percentage, 0) / mockTrend.length) * 100) / 100
        : null,
      bestPercentage: mockTrend.length ? Math.max(...mockTrend.map((point) => point.percentage)) : null,
      latestPercentage: mockTrend.length ? (mockTrend[mockTrend.length - 1]?.percentage ?? null) : null,
      trend: mockTrend,
    },
    recentSessions: sessionRows.map((session) => ({
      id: session.id,
      studyItemId: session.studyItemId,
      itemName: session.studyItem?.name ?? null,
      startedAt: session.startedAt.toISOString(),
      minutes: sessionMinutes(session),
      notes: session.notes,
    })),
    upcomingDeadlines,
  };
};

const sessionRowsAllMinutes = (rows: Array<{ startedAt: Date; endedAt: Date | null; manualMinutes: number | null }>): number =>
  rows.reduce((sum, row) => sum + sessionMinutes(row), 0);

/** Cross-assessment overview for the global dashboard. */
export const globalOverview = async (userId: string, now: Date = new Date()) => {
  const assessments = await prisma.assessment.findMany({
    where: { userId, archivedAt: null },
    select: { id: true, name: true, examDate: true, timeZone: true, status: true, accentColor: true },
    orderBy: [{ examDate: 'asc' }],
  });

  const rows = await Promise.all(
    assessments.map(async (assessment) => {
      const [items, sessions, overdue, bookmarks] = await Promise.all([
        prisma.studyItem.findMany({
          where: { assessmentId: assessment.id },
          select: { completed: true, estimatedMinutes: true, dueDate: true, completedAt: true },
        }),
        prisma.studySession.findMany({
          where: { assessmentId: assessment.id },
          select: { startedAt: true, endedAt: true, manualMinutes: true },
        }),
        prisma.studyItem.count({
          where: { assessmentId: assessment.id, completed: false, dueDate: { lt: startOfDayInZone(now, assessment.timeZone) } },
        }),
        prisma.bookmark.count({
          where: {
            userId,
            OR: [
              { studyItem: { assessmentId: assessment.id } },
              { syllabusNode: { assessmentId: assessment.id } },
              { note: { assessmentId: assessment.id } },
              { mockTest: { assessmentId: assessment.id } },
            ],
          },
        }),
      ]);

      const total = items.length;
      const completed = items.filter((item) => item.completed).length;

      return {
        id: assessment.id,
        name: assessment.name,
        status: assessment.status,
        accentColor: assessment.accentColor,
        examDate: assessment.examDate?.toISOString() ?? null,
        daysUntilExam: assessment.examDate
          ? calendarDaysBetween(now, assessment.examDate, assessment.timeZone)
          : null,
        items: total,
        completedItems: completed,
        completionPercentage: percentageOf(completed, total),
        estimatedMinutes: items.reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0),
        actualMinutes: sessions.reduce((sum, session) => sum + sessionMinutes(session), 0),
        overdueItems: overdue,
        bookmarkedItems: bookmarks,
      };
    }),
  );

  return {
    assessments: rows,
    totals: {
      assessments: rows.length,
      items: rows.reduce((sum, row) => sum + row.items, 0),
      completedItems: rows.reduce((sum, row) => sum + row.completedItems, 0),
      actualMinutes: rows.reduce((sum, row) => sum + row.actualMinutes, 0),
      overdueItems: rows.reduce((sum, row) => sum + row.overdueItems, 0),
      bookmarkedItems: rows.reduce((sum, row) => sum + row.bookmarkedItems, 0),
    },
  };
};
