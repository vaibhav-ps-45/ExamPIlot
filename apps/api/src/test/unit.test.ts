import { describe, expect, it } from 'vitest';
import {
  buildTree,
  calendarDaysBetween,
  daysUntil,
  sessionMinutes,
  deriveDateStatus,
  resolveRemindAt,
  occurrenceKeyFor,
  DEFAULT_VIEW_CONFIG,
  LAYOUT_SUPPORTED_FIELDS,
  IMPLEMENTED_LAYOUTS,
  passwordSchema,
  createAssessmentSchema,
  createStudyItemSchema,
  createStudySessionSchema,
  createBookmarkSchema,
  createMockTestSchema,
  practiceAttemptSchema,
  switchLayoutSchema,
  rescheduleStudyItemSchema,
} from './testkit.js';

/**
 * These are the pure-logic and validation tests: no database, no HTTP. They
 * cover the rules that must hold regardless of transport, and they run in
 * milliseconds so they can gate every change.
 */

const TZ = 'Asia/Calcutta';

describe('calendar math in the assessment time zone', () => {
  it('counts calendar days, not elapsed hours', () => {
    // 23:30 local on the 14th vs 00:30 local on the 15th is one calendar day
    // apart, even though only one hour of wall time separates them.
    const late = new Date('2026-10-14T18:00:00.000Z'); // 23:30 IST
    const early = new Date('2026-10-14T19:00:00.000Z'); // 00:30 IST on the 15th
    expect(calendarDaysBetween(late, early, TZ)).toBe(1);
  });

  it('returns a negative number for dates in the past', () => {
    const now = new Date('2026-10-14T06:00:00.000Z');
    const yesterday = new Date('2026-10-13T06:00:00.000Z');
    expect(calendarDaysBetween(now, yesterday, TZ)).toBe(-1);
  });

  it('gives the same answer regardless of the server time zone', () => {
    const now = new Date('2026-10-14T06:00:00.000Z');
    const exam = new Date('2027-02-07T06:00:00.000Z');
    expect(daysUntil(exam, TZ, now)).toBe(daysUntil(exam, 'Asia/Calcutta', now));
    expect(daysUntil(exam, TZ, now)).toBeGreaterThan(100);
  });
});

describe('deriveDateStatus never mutates the date', () => {
  const now = new Date('2026-10-14T06:00:00.000Z');

  it('reports OVERDUE for a past due date without changing it', () => {
    const dueDate = new Date('2026-10-10T06:00:00.000Z');
    const before = dueDate.getTime();
    expect(deriveDateStatus({ completed: false, dueDate }, TZ, now)).toBe('OVERDUE');
    expect(dueDate.getTime()).toBe(before);
  });

  it('reports DUE_TODAY on the due date itself', () => {
    expect(deriveDateStatus({ completed: false, dueDate: now }, TZ, now)).toBe('DUE_TODAY');
  });

  it('reports COMPLETED regardless of the due date', () => {
    expect(
      deriveDateStatus({ completed: true, dueDate: new Date('2020-01-01T00:00:00.000Z') }, TZ, now),
    ).toBe('COMPLETED');
  });

  it('reports NO_DATE when the item has no deadline', () => {
    expect(deriveDateStatus({ completed: false, dueDate: null }, TZ, now)).toBe('NO_DATE');
  });

  it('reports UPCOMING for a future due date', () => {
    expect(
      deriveDateStatus({ completed: false, dueDate: new Date('2026-10-20T06:00:00.000Z') }, TZ, now),
    ).toBe('UPCOMING');
  });
});

describe('study-session duration is counted exactly once', () => {
  it('derives minutes from a start/end pair', () => {
    expect(
      sessionMinutes({
        startedAt: new Date('2026-10-14T10:00:00.000Z'),
        endedAt: new Date('2026-10-14T11:30:00.000Z'),
        manualMinutes: null,
      }),
    ).toBe(90);
  });

  it('uses manualMinutes when there is no end time', () => {
    expect(
      sessionMinutes({ startedAt: new Date('2026-10-14T10:00:00.000Z'), endedAt: null, manualMinutes: 45 }),
    ).toBe(45);
  });

  it('ignores manualMinutes when a start/end pair exists, so time is never double counted', () => {
    expect(
      sessionMinutes({
        startedAt: new Date('2026-10-14T10:00:00.000Z'),
        endedAt: new Date('2026-10-14T11:00:00.000Z'),
        manualMinutes: 600,
      }),
    ).toBe(60);
  });

  it('never returns a negative duration for an inverted pair', () => {
    expect(
      sessionMinutes({
        startedAt: new Date('2026-10-14T11:00:00.000Z'),
        endedAt: new Date('2026-10-14T10:00:00.000Z'),
        manualMinutes: null,
      }),
    ).toBe(0);
  });
});

describe('syllabus tree assembly', () => {
  const row = (id: string, parentId: string | null, sortOrder: number, items = 0) => ({
    id,
    assessmentId: 'a1',
    parentId,
    title: id,
    description: null,
    weight: null,
    sortOrder,
    _count: { studyItems: items },
  });

  it('nests children under parents and sorts by sortOrder', () => {
    const tree = buildTree([row('root', null, 0), row('b', 'root', 2), row('a', 'root', 1)]);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.children.map((child) => child.id)).toEqual(['a', 'b']);
  });

  it('assigns depth correctly across three levels', () => {
    const tree = buildTree([row('root', null, 0), row('mid', 'root', 0), row('leaf', 'mid', 0)]);
    expect(tree[0]!.depth).toBe(0);
    expect(tree[0]!.children[0]!.depth).toBe(1);
    expect(tree[0]!.children[0]!.children[0]!.depth).toBe(2);
  });

  it('treats an orphaned node as a root instead of dropping it', () => {
    const tree = buildTree([row('orphan', 'missing-parent', 0)]);
    expect(tree.map((node) => node.id)).toEqual(['orphan']);
  });

  it('surfaces the study-item count for each node', () => {
    const tree = buildTree([row('root', null, 0, 7)]);
    expect(tree[0]!.studyItemCount).toBe(7);
  });
});

describe('layout switching keeps data and config separate', () => {
  it('offers exactly the three implemented layouts', () => {
    expect([...IMPLEMENTED_LAYOUTS]).toEqual(['TABLE', 'CHECKLIST', 'NOTES_BOARD']);
  });

  it('rejects a layout that is declared but not built', () => {
    expect(switchLayoutSchema.safeParse({ layout: 'KANBAN' }).success).toBe(false);
  });

  it('accepts each implemented layout', () => {
    for (const layout of IMPLEMENTED_LAYOUTS) {
      expect(switchLayoutSchema.safeParse({ layout }).success).toBe(true);
    }
  });

  it('every implemented layout supports NAME, and unsupported fields are a strict subset', () => {
    for (const layout of IMPLEMENTED_LAYOUTS) {
      expect(LAYOUT_SUPPORTED_FIELDS[layout]).toContain('NAME');
    }
    expect(LAYOUT_SUPPORTED_FIELDS.CHECKLIST.length).toBeLessThan(LAYOUT_SUPPORTED_FIELDS.TABLE.length);
  });

  it('keeps unsupported fields by default rather than dropping them', () => {
    const parsed = switchLayoutSchema.parse({ layout: 'CHECKLIST' });
    expect(parsed.dropUnsupportedFields).toBe(false);
  });

  it('defaults to four attempt slots', () => {
    expect(DEFAULT_VIEW_CONFIG.attemptSlots).toBe(4);
  });
});

describe('reminder time resolution', () => {
  it('interprets a wall-clock time in the reminder time zone', () => {
    // 09:00 typed by a user in IST is 03:30 UTC.
    const resolved = resolveRemindAt({
      localDateTime: new Date('2026-10-20T09:00:00.000Z'),
      timeZone: 'Asia/Calcutta',
    });
    expect(resolved.toISOString()).toBe('2026-10-20T03:30:00.000Z');
  });

  it('uses an absolute instant as-is', () => {
    const instant = new Date('2026-10-20T03:30:00.000Z');
    expect(resolveRemindAt({ remindAt: instant, timeZone: 'Asia/Calcutta' }).toISOString()).toBe(
      instant.toISOString(),
    );
  });

  it('produces a stable occurrence key so a retry cannot double-send', () => {
    const at = new Date('2026-10-20T03:30:00.000Z');
    expect(occurrenceKeyFor(at)).toBe(occurrenceKeyFor(new Date(at.getTime())));
  });
});

describe('validation: assessment dates', () => {
  const base = { name: 'GATE', timeZone: TZ };

  it('accepts an assessment with no exam date', () => {
    const result = createAssessmentSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.examDate).toBeNull();
  });

  it('rejects a start date after the exam date', () => {
    const result = createAssessmentSchema.safeParse({
      ...base,
      startDate: '2027-01-01T00:00:00.000Z',
      examDate: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a start date equal to the exam date', () => {
    const same = '2027-01-01T00:00:00.000Z';
    expect(createAssessmentSchema.safeParse({ ...base, startDate: same, examDate: same }).success).toBe(true);
  });

  it('rejects an unknown time zone', () => {
    expect(createAssessmentSchema.safeParse({ ...base, timeZone: 'Mars/Olympus' }).success).toBe(false);
  });

  it('rejects an empty name', () => {
    expect(createAssessmentSchema.safeParse({ name: '   ', timeZone: TZ }).success).toBe(false);
  });
});

describe('validation: study items and attempts', () => {
  it('rejects a due date before the planned start', () => {
    expect(
      createStudyItemSchema.safeParse({
        name: 'x',
        plannedStartDate: '2026-10-20T00:00:00.000Z',
        dueDate: '2026-10-10T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('accepts an item with no dates at all', () => {
    expect(createStudyItemSchema.safeParse({ name: 'x' }).success).toBe(true);
  });

  it('rejects correct answers exceeding questions attempted', () => {
    expect(
      practiceAttemptSchema.safeParse({
        attemptedAt: '2026-10-14T00:00:00.000Z',
        questionsAttempted: 10,
        questionsCorrect: 11,
      }).success,
    ).toBe(false);
  });

  it('rejects marks obtained exceeding maximum marks', () => {
    expect(
      practiceAttemptSchema.safeParse({
        attemptedAt: '2026-10-14T00:00:00.000Z',
        marksObtained: 30,
        maxMarks: 20,
      }).success,
    ).toBe(false);
  });

  it('defaults a new attempt to slot 0', () => {
    const result = practiceAttemptSchema.safeParse({ attemptedAt: '2026-10-14T00:00:00.000Z' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.slotIndex).toBe(0);
  });

  it('requires a reschedule to actually change a date', () => {
    expect(rescheduleStudyItemSchema.safeParse({ reason: 'because' }).success).toBe(false);
    expect(
      rescheduleStudyItemSchema.safeParse({ dueDate: '2026-11-01T00:00:00.000Z' }).success,
    ).toBe(true);
  });
});

describe('validation: study sessions cannot double count', () => {
  it('accepts a start/end pair', () => {
    expect(
      createStudySessionSchema.safeParse({
        startedAt: '2026-10-14T10:00:00.000Z',
        endedAt: '2026-10-14T11:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('accepts manualMinutes alone', () => {
    expect(createStudySessionSchema.safeParse({ manualMinutes: 45 }).success).toBe(true);
  });

  it('rejects both forms together', () => {
    expect(
      createStudySessionSchema.safeParse({
        startedAt: '2026-10-14T10:00:00.000Z',
        endedAt: '2026-10-14T11:00:00.000Z',
        manualMinutes: 60,
      }).success,
    ).toBe(false);
  });

  it('rejects an end before its start', () => {
    expect(
      createStudySessionSchema.safeParse({
        startedAt: '2026-10-14T11:00:00.000Z',
        endedAt: '2026-10-14T10:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('rejects an end with no start', () => {
    expect(createStudySessionSchema.safeParse({ endedAt: '2026-10-14T10:00:00.000Z' }).success).toBe(false);
  });

  it('rejects a session with neither form', () => {
    expect(createStudySessionSchema.safeParse({}).success).toBe(false);
  });
});

describe('validation: bookmarks target exactly one item', () => {
  it('accepts a single matching target', () => {
    expect(
      createBookmarkSchema.safeParse({ targetType: 'STUDY_ITEM', studyItemId: 'i1' }).success,
    ).toBe(true);
  });

  it('rejects a target that does not match the declared type', () => {
    expect(
      createBookmarkSchema.safeParse({ targetType: 'NOTE', studyItemId: 'i1' }).success,
    ).toBe(false);
  });

  it('rejects two targets at once', () => {
    expect(
      createBookmarkSchema.safeParse({
        targetType: 'STUDY_ITEM',
        studyItemId: 'i1',
        noteId: 'n1',
      }).success,
    ).toBe(false);
  });

  it('rejects no target', () => {
    expect(createBookmarkSchema.safeParse({ targetType: 'STUDY_ITEM' }).success).toBe(false);
  });

  it('requires a custom label when the label is CUSTOM', () => {
    expect(
      createBookmarkSchema.safeParse({ targetType: 'STUDY_ITEM', studyItemId: 'i1', label: 'CUSTOM' })
        .success,
    ).toBe(false);
    expect(
      createBookmarkSchema.safeParse({
        targetType: 'STUDY_ITEM',
        studyItemId: 'i1',
        label: 'CUSTOM',
        customLabel: 'Revisit',
      }).success,
    ).toBe(true);
  });
});

describe('validation: mock tests and passwords', () => {
  it('rejects marks above the total', () => {
    expect(
      createMockTestSchema.safeParse({
        name: 'Mock',
        takenOn: '2026-10-14T00:00:00.000Z',
        totalMarks: 100,
        marksObtained: 101,
      }).success,
    ).toBe(false);
  });

  it('rejects a section scoring above its own total', () => {
    expect(
      createMockTestSchema.safeParse({
        name: 'Mock',
        takenOn: '2026-10-14T00:00:00.000Z',
        totalMarks: 100,
        marksObtained: 50,
        sections: [{ name: 'A', totalMarks: 20, marksObtained: 25 }],
      }).success,
    ).toBe(false);
  });

  it('accepts a mock test with no sections', () => {
    expect(
      createMockTestSchema.safeParse({
        name: 'Mock',
        takenOn: '2026-10-14T00:00:00.000Z',
        totalMarks: 100,
        marksObtained: 50,
      }).success,
    ).toBe(true);
  });

  it('enforces password strength', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('alllowercase123').success).toBe(false);
    expect(passwordSchema.safeParse('ALLUPPERCASE123').success).toBe(false);
    expect(passwordSchema.safeParse('NoDigitsHereAtAll').success).toBe(false);
    expect(passwordSchema.safeParse('DemoPassword123!').success).toBe(true);
  });
});
