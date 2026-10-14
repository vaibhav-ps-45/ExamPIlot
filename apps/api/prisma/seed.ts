/**
 * Reproducible development seed.
 *
 * Guarantees:
 * - Idempotent: running it twice does not duplicate anything. The demo account
 *   is matched by email and its workspace is rebuilt only with `--reset`.
 * - Realistic but clearly synthetic: the demo user is `demo@exampilot.local`
 *   and every record is marked as demo data. Real user accounts are never
 *   touched, and no seed data is ever inserted into a non-demo account.
 * - Reminders are created ONLY where the seed explicitly asks for one, because
 *   the product requires reminders to be an explicit opt-in.
 *
 * Usage:
 *   npm run prisma:seed              # create/refresh the demo workspace
 *   npm run prisma:seed -- --reset   # delete and rebuild the demo workspace
 */
import bcrypt from 'bcryptjs';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const SEED_EMAIL = process.env.SEED_USER_EMAIL ?? 'demo@exampilot.local';
const SEED_PASSWORD = process.env.SEED_USER_PASSWORD ?? 'DemoPassword123!';
const SEED_NAME = 'Demo Student';
const SEED_TZ = 'Asia/Calcutta';

const shouldReset = process.argv.includes('--reset');

const log = (message: string) => process.stdout.write(`${message}\n`);

/** Dates are written relative to "today" so the seed stays useful over time. */
const dayOffset = (days: number, hour = 9): Date => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
};

const buildGateTemplateNodes = () => [
  {
    title: 'Engineering Mathematics',
    children: [
      { title: 'Discrete Mathematics', children: [{ title: 'Graph Theory' }, { title: 'Combinatorics' }] },
      { title: 'Linear Algebra', children: [{ title: 'Matrices' }, { title: 'Eigenvalues' }] },
      { title: 'Probability and Statistics', children: [{ title: 'Distributions' }] },
    ],
  },
  {
    title: 'Algorithms',
    children: [
      { title: 'Greedy Algorithms', children: [] as Array<{ title: string }> },
      { title: 'Dynamic Programming', children: [] as Array<{ title: string }> },
      { title: 'Graph Traversals', children: [] as Array<{ title: string }> },
    ],
  },
  {
    title: 'Operating System',
    children: [
      { title: 'Process Scheduling', children: [] as Array<{ title: string }> },
      { title: 'Memory Management', children: [] as Array<{ title: string }> },
    ],
  },
  {
    title: 'Databases',
    children: [
      { title: 'Normalization', children: [] as Array<{ title: string }> },
      { title: 'Transactions', children: [] as Array<{ title: string }> },
    ],
  },
];

async function main(): Promise<void> {
  log(`Seeding demo account: ${SEED_EMAIL}`);

  const existing = await prisma.user.findUnique({
    where: { email: SEED_EMAIL },
    select: { id: true },
  });

  if (existing && shouldReset) {
    // Cascades clean up every dependent row. Only the demo account is removed.
    await prisma.user.delete({ where: { id: existing.id } });
    log('  removed previous demo workspace (--reset)');
  }

  if (existing && !shouldReset) {
    log('  demo account already exists; nothing to do. Re-run with --reset to rebuild.');
    return;
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  const user = await prisma.user.create({
    data: {
      email: SEED_EMAIL,
      passwordHash,
      displayName: SEED_NAME,
      timeZone: SEED_TZ,
      settings: { create: { defaultTimeZone: SEED_TZ, theme: 'SYSTEM' } },
    },
    select: { id: true },
  });
  const userId = user.id;

  // ---------------------------------------------------------------- assessment
  const assessment = await prisma.assessment.create({
    data: {
      userId,
      name: 'GATE CS 2027',
      category: 'Competitive Exam',
      description: 'Demo workspace. Every date here is relative to the day you ran the seed.',
      startDate: dayOffset(-30),
      examDate: dayOffset(116),
      timeZone: SEED_TZ,
      status: 'ACTIVE',
      accentColor: '#4f46e5',
      schedulePref: {
        create: { preferredStudyDays: [1, 2, 3, 4, 5, 6], dailyTargetMinutes: 180 },
      },
    },
    select: { id: true },
  });
  const assessmentId = assessment.id;
  log('  assessment: GATE CS 2027');

  // ---------------------------------------------------------------- syllabus
  const nodeIds: string[] = [];
  const insertNodes = async (
    nodes: ReturnType<typeof buildGateTemplateNodes>,
    parentId: string | null,
  ): Promise<void> => {
    for (const [index, node] of nodes.entries()) {
      const created = await prisma.syllabusNode.create({
        data: {
          assessmentId,
          parentId,
          title: node.title,
          sortOrder: index,
        },
        select: { id: true },
      });
      nodeIds.push(created.id);
      if (node.children?.length) {
        await insertNodes(node.children as ReturnType<typeof buildGateTemplateNodes>, created.id);
      }
    }
  };
  await insertNodes(buildGateTemplateNodes(), null);
  log(`  syllabus: ${nodeIds.length} nodes`);

  // --------------------------------------------------------------- trackers
  const tableTracker = await prisma.tracker.create({
    data: {
      assessmentId,
      name: 'Study Tracker',
      layout: 'TABLE',
      accentColor: '#4f46e5',
      density: 'COMFORTABLE',
      isDefault: true,
      sortOrder: 0,
      viewConfig: { attemptSlots: 4, showCompleted: true, groupBySubject: false, notesBoardColumns: 3 },
      columns: {
        create: [
          { fieldKey: 'NAME', sortOrder: 0, width: 260, visible: true },
          { fieldKey: 'SUBJECT', sortOrder: 1, width: 170, visible: true },
          { fieldKey: 'PRIORITY', sortOrder: 2, width: 110, visible: true },
          { fieldKey: 'PLANNED_START', sortOrder: 3, width: 140, visible: true },
          { fieldKey: 'DUE_DATE', sortOrder: 4, width: 140, visible: true },
          { fieldKey: 'ESTIMATED_MINUTES', label: 'Est.', sortOrder: 5, width: 90, visible: true },
          { fieldKey: 'ACTUAL_MINUTES', label: 'Actual', sortOrder: 6, width: 90, visible: true },
          { fieldKey: 'ATTEMPTS', sortOrder: 7, width: 110, visible: true },
          { fieldKey: 'BOOKMARK', label: 'Saved', sortOrder: 8, width: 90, visible: true },
        ],
      },
    },
    select: { id: true },
  });

  await prisma.tracker.create({
    data: {
      assessmentId,
      name: 'Revision Checklist',
      layout: 'CHECKLIST',
      accentColor: '#059669',
      density: 'COMPACT',
      sortOrder: 1,
      viewConfig: { attemptSlots: 4, showCompleted: true, groupBySubject: true, notesBoardColumns: 3 },
      columns: {
        create: [
          { fieldKey: 'NAME', sortOrder: 0, visible: true },
          { fieldKey: 'SUBJECT', sortOrder: 1, visible: true },
          { fieldKey: 'PRIORITY', sortOrder: 2, visible: true },
          { fieldKey: 'DUE_DATE', label: 'Due', sortOrder: 3, visible: true },
          { fieldKey: 'ATTEMPTS', sortOrder: 4, visible: true },
        ],
      },
    },
  });

  await prisma.tracker.create({
    data: {
      assessmentId,
      name: 'Weak Areas Board',
      layout: 'NOTES_BOARD',
      accentColor: '#d97706',
      density: 'SPACIOUS',
      sortOrder: 2,
      viewConfig: { attemptSlots: 4, showCompleted: true, groupBySubject: false, notesBoardColumns: 3 },
      columns: {
        create: [
          { fieldKey: 'NAME', sortOrder: 0, visible: true },
          { fieldKey: 'DESCRIPTION', sortOrder: 1, visible: true },
          { fieldKey: 'SUBJECT', sortOrder: 2, visible: true },
          { fieldKey: 'BOOKMARK', sortOrder: 3, visible: true },
        ],
      },
    },
  });

  // Saved view on the default tracker, so "save and restore a view" is visible
  // in the demo without the user having to create one first.
  await prisma.trackerView.create({
    data: {
      id: `${tableTracker.id}:overdue`.slice(0, 30),
      trackerId: tableTracker.id,
      name: 'Overdue only',
      isDefault: false,
      filters: { completed: false } as Prisma.InputJsonValue,
      sorts: { field: 'DUE_DATE', direction: 'asc' } as Prisma.InputJsonValue,
    },
  });

  log('  trackers: 3 (table, checklist, notes board) + 1 saved view');

  // ------------------------------------------------------------ custom field
  const revisionField = await prisma.assessmentCustomField.create({
    data: {
      assessmentId,
      key: 'revisionRounds',
      label: 'Revision rounds done',
      type: 'NUMBER',
      sortOrder: 0,
    },
    select: { id: true },
  });

  // ------------------------------------------------------------ study items
  type SeedItem = {
    name: string;
    subject: string;
    topic: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    plannedStart: number;
    due: number;
    estimated: number;
    completed?: boolean;
    completedOn?: number;
    description?: string;
    customValue?: string;
  };

  const seedItems: SeedItem[] = [
    {
      name: 'Graph Theory — BFS/DFS problems',
      subject: 'Engineering Mathematics',
      topic: 'Discrete Mathematics',
      priority: 'HIGH',
      plannedStart: -5,
      due: 3,
      estimated: 180,
      description: 'Solve 25 problems from the standard problem set. Focus on cycle detection.',
      customValue: '2',
    },
    {
      name: 'Dynamic Programming — LIS and LCS',
      subject: 'Algorithms',
      topic: 'Dynamic Programming',
      priority: 'URGENT',
      plannedStart: -2,
      due: -1, // deliberately overdue: shows the Overdue status without moving the date
      estimated: 240,
      description: 'Overdue on purpose: the date stays exactly as planned, only the status changes.',
      customValue: '1',
    },
    {
      name: 'Process Scheduling — Gantt practice',
      subject: 'Operating System',
      topic: 'Process Scheduling',
      priority: 'MEDIUM',
      plannedStart: -10,
      due: -6,
      estimated: 120,
      completed: true,
      completedOn: -7, // completed before the deadline
    },
    {
      name: 'Normalization — 1NF to BCNF',
      subject: 'Databases',
      topic: 'Normalization',
      priority: 'MEDIUM',
      plannedStart: -12,
      due: -8,
      estimated: 150,
      completed: true,
      completedOn: -4, // completed AFTER the deadline: counts as slippage
      customValue: '3',
    },
    {
      name: 'Transactions and Concurrency Control',
      subject: 'Databases',
      topic: 'Transactions',
      priority: 'HIGH',
      plannedStart: 1,
      due: 9,
      estimated: 200,
    },
    {
      name: 'Probability — Bayes theorem drills',
      subject: 'Engineering Mathematics',
      topic: 'Probability and Statistics',
      priority: 'LOW',
      plannedStart: 4,
      due: 14,
      estimated: 90,
    },
    {
      name: 'Memory Management — paging and segmentation',
      subject: 'Operating System',
      topic: 'Memory Management',
      priority: 'HIGH',
      plannedStart: 2,
      due: 7,
      estimated: 160,
    },
    {
      name: 'Greedy Algorithms — interval scheduling',
      subject: 'Algorithms',
      topic: 'Greedy Algorithms',
      priority: 'MEDIUM',
      plannedStart: 6,
      due: 18,
      estimated: 120,
    },
  ];

  const createdItems: Array<{ id: string; name: string; index: number }> = [];

  for (const [index, item] of seedItems.entries()) {
    const created = await prisma.studyItem.create({
      data: {
        assessmentId,
        trackerId: tableTracker.id,
        name: item.name,
        description: item.description ?? null,
        subject: item.subject,
        topic: item.topic,
        priority: item.priority,
        plannedStartDate: dayOffset(item.plannedStart),
        dueDate: dayOffset(item.due),
        estimatedMinutes: item.estimated,
        completed: item.completed ?? false,
        completedAt: item.completedOn !== undefined ? dayOffset(item.completedOn, 18) : null,
        sortOrder: index,
        ...(item.customValue
          ? { customValues: { create: [{ customFieldId: revisionField.id, value: item.customValue }] } }
          : {}),
      },
      select: { id: true },
    });
    createdItems.push({ id: created.id, name: created ? item.name : '', index });
  }
  log(`  study items: ${createdItems.length}`);

  // ------------------------------------------------------- practice attempts
  // Four attempt slots on the first item, matching the default tracker config.
  const graphItem = createdItems[0]!;
  const attemptData = [
    { slotIndex: 0, days: -9, attempted: 20, correct: 11, marks: 11, max: 20, minutes: 45 },
    { slotIndex: 1, days: -5, attempted: 20, correct: 14, marks: 14, max: 20, minutes: 40 },
    { slotIndex: 2, days: -2, attempted: 25, correct: 20, marks: 20, max: 25, minutes: 50 },
  ];
  for (const attempt of attemptData) {
    await prisma.practiceAttempt.create({
      data: {
        studyItemId: graphItem.id,
        slotIndex: attempt.slotIndex,
        attemptedAt: dayOffset(attempt.days, 20),
        questionsAttempted: attempt.attempted,
        questionsCorrect: attempt.correct,
        marksObtained: attempt.marks,
        maxMarks: attempt.max,
        durationMinutes: attempt.minutes,
        notes: `Attempt ${attempt.slotIndex + 1} — improving each round.`,
      },
    });
  }
  log(`  practice attempts: ${attemptData.length} (slots 0-2 of 4)`);

  // ---------------------------------------------------------- study sessions
  // Sessions that produce the same actual-minutes total the UI will display.
  const sessionData = [
    { item: 0, days: -9, startHour: 10, minutes: 90 },
    { item: 0, days: -5, startHour: 14, minutes: 60 },
    { item: 1, days: -3, startHour: 9, minutes: 120 },
    { item: 2, days: -8, startHour: 16, minutes: 75 },
    { item: 3, days: -5, startHour: 11, minutes: 100 },
  ];
  for (const session of sessionData) {
    const startedAt = dayOffset(session.days, session.startHour);
    const endedAt = new Date(startedAt.getTime() + session.minutes * 60_000);
    const target = createdItems[session.item]!;
    await prisma.studySession.create({
      data: {
        userId,
        assessmentId,
        studyItemId: target.id,
        startedAt,
        endedAt,
        notes: 'Seeded session.',
      },
    });
    // Keep the denormalised total in step with the sessions just created.
    const all = await prisma.studySession.findMany({
      where: { studyItemId: target.id },
      select: { startedAt: true, endedAt: true, manualMinutes: true },
    });
    const total = all.reduce((sum, row) => {
      if (row.startedAt && row.endedAt) {
        return sum + Math.max(0, Math.round((row.endedAt.getTime() - row.startedAt.getTime()) / 60000));
      }
      return sum + (row.manualMinutes ?? 0);
    }, 0);
    await prisma.studyItem.update({ where: { id: target.id }, data: { actualMinutes: total } });
  }
  // One manual-duration session, to show the alternative entry mode.
  await prisma.studySession.create({
    data: {
      userId,
      assessmentId,
      studyItemId: createdItems[5]!.id,
      startedAt: dayOffset(-1, 21),
      manualMinutes: 45,
      notes: 'Manually logged revision (no start/end pair).',
    },
  });
  await prisma.studyItem.update({
    where: { id: createdItems[5]!.id },
    data: { actualMinutes: 45 },
  });
  log(`  study sessions: ${sessionData.length + 1}`);

  // --------------------------------------------------------------- bookmarks
  await prisma.bookmark.create({
    data: {
      userId,
      targetType: 'STUDY_ITEM',
      studyItemId: createdItems[1]!.id,
      label: 'DIFFICULT',
      reason: 'Struggling with the O(n log n) proof — come back to this.',
    },
  });
  await prisma.bookmark.create({
    data: {
      userId,
      targetType: 'STUDY_ITEM',
      studyItemId: createdItems[4]!.id,
      label: 'REVISE',
      reason: 'Needs a second pass before the mock.',
    },
  });
  await prisma.bookmark.create({
    data: {
      userId,
      targetType: 'SYLLABUS_TOPIC',
      syllabusNodeId: nodeIds[1]!,
      label: 'IMPORTANT',
      reason: 'High weightage in the previous three papers.',
    },
  });
  log('  bookmarks: 3 (2 items, 1 syllabus topic)');

  // -------------------------------------------------------------------- notes
  const note = await prisma.note.create({
    data: {
      userId,
      assessmentId,
      studyItemId: createdItems[1]!.id,
      title: 'DP recurrence patterns',
      body:
        'LIS: dp[i] = 1 + max(dp[j]) for j < i where a[j] < a[i].\n' +
        'LCS: dp[i][j] = dp[i-1][j-1] + 1 when equal, else max(dp[i-1][j], dp[i][j-1]).\n' +
        'Always draw the table before writing code.',
      pinned: true,
    },
    select: { id: true },
  });
  await prisma.note.create({
    data: {
      userId,
      assessmentId,
      title: 'Exam-day checklist',
      body: 'Admit card, ID, transparent water bottle, analogue watch. Reach the centre 45 minutes early.',
      pinned: false,
    },
  });
  await prisma.bookmark.create({
    data: {
      userId,
      targetType: 'NOTE',
      noteId: note.id,
      label: 'IMPORTANT',
      reason: 'Read this before every mock.',
    },
  });
  log('  notes: 2 (+1 bookmark on a note)');

  // --------------------------------------------------------------- mock tests
  const mockData = [
    { name: 'Full Mock 1', days: -21, total: 100, obtained: 48, minutes: 180 },
    { name: 'Full Mock 2', days: -14, total: 100, obtained: 57, minutes: 180 },
    { name: 'Subject Mock — Algorithms', days: -7, total: 50, obtained: 33, minutes: 90 },
    { name: 'Full Mock 3', days: -2, total: 100, obtained: 68, minutes: 180 },
  ];
  const firstMock = await prisma.mockTest.create({
    data: {
      userId,
      assessmentId,
      name: mockData[0]!.name,
      takenOn: dayOffset(mockData[0]!.days, 10),
      totalMarks: mockData[0]!.total,
      marksObtained: mockData[0]!.obtained,
      durationMinutes: mockData[0]!.minutes,
      sections: [
        { name: 'General Aptitude', totalMarks: 15, marksObtained: 9 },
        { name: 'Core CS', totalMarks: 85, marksObtained: 39 },
      ] as Prisma.InputJsonValue,
      notes: 'Ran out of time in the Algorithms section.',
      reviewed: true,
    },
    select: { id: true },
  });
  for (const mock of mockData.slice(1)) {
    await prisma.mockTest.create({
      data: {
        userId,
        assessmentId,
        name: mock.name,
        takenOn: dayOffset(mock.days, 10),
        totalMarks: mock.total,
        marksObtained: mock.obtained,
        durationMinutes: mock.minutes,
        notes: null,
        reviewed: mock.days < -5,
      },
    });
  }
  await prisma.bookmark.create({
    data: {
      userId,
      targetType: 'MOCK_TEST',
      mockTestId: firstMock.id,
      label: 'CONTINUE_LATER',
      reason: 'Review the unattempted questions in the Core CS section.',
    },
  });
  log(`  mock tests: ${mockData.length} (rising trend 48% → 68%)`);

  // ---------------------------------------------------------------- reminders
  // Explicitly created, and only two of them. Nothing else in this seed
  // generates a reminder, which is the behaviour the product requires.
  await prisma.reminder.create({
    data: {
      userId,
      assessmentId,
      studyItemId: createdItems[4]!.id,
      title: 'Revise Transactions before the mock',
      message: 'Two-pass revision planned for this evening.',
      remindAt: dayOffset(1, 19),
      localDateTime: dayOffset(1, 19),
      timeZone: SEED_TZ,
      advanceMinutes: 30,
      recurrence: 'NONE',
      enabled: true,
      status: 'PENDING',
    },
  });
  await prisma.reminder.create({
    data: {
      userId,
      assessmentId,
      title: 'Weekly progress review',
      message: 'Compare planned versus actual for the week.',
      remindAt: dayOffset(3, 18),
      localDateTime: dayOffset(3, 18),
      timeZone: SEED_TZ,
      advanceMinutes: null,
      recurrence: 'WEEKLY',
      enabled: true,
      status: 'PENDING',
    },
  });
  log('  reminders: 2 (explicitly opted in)');

  log('\nSeed complete.');
  log(`  Sign in with ${SEED_EMAIL} / ${SEED_PASSWORD}`);
  log('  Everything above belongs to the demo account only.');
}

main()
  .catch((error) => {
    process.stderr.write(`Seed failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
