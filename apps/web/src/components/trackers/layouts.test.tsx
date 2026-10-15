import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FieldKey, TrackerLayout } from '@exampilot/shared';
import type { StudyItem, Tracker } from '@/lib/types';
import { ChecklistLayout } from './checklist-layout';
import { NotesBoardLayout } from './notes-board-layout';
import { columnsForLayout, type LayoutContext } from './shared';
import { TableLayout } from './table-layout';

const FIELDS: FieldKey[] = [
  'NAME',
  'SUBJECT',
  'PRIORITY',
  'DUE_DATE',
  'ESTIMATED_MINUTES',
  'ACTUAL_MINUTES',
  'ATTEMPTS',
  'BOOKMARK',
  'DESCRIPTION',
];

const makeTracker = (layout: TrackerLayout): Tracker => ({
  id: 't1',
  assessmentId: 'a1',
  name: 'Main',
  layout,
  accentColor: null,
  density: 'COMFORTABLE',
  viewConfig: { attemptSlots: 4, showCompleted: true, groupBySubject: false, notesBoardColumns: 3 },
  isDefault: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  itemCount: 2,
  savedViews: [],
  columns: FIELDS.map((fieldKey, index) => ({
    id: `c${index}`,
    fieldKey,
    customFieldId: null,
    label: null,
    width: null,
    visible: true,
    sortOrder: index,
  })),
});

const makeItem = (over: Partial<StudyItem>): StudyItem => ({
  id: 'i1',
  assessmentId: 'a1',
  trackerId: 't1',
  syllabusNodeId: null,
  name: 'Graph theory',
  description: 'Paths and cycles',
  subject: 'Discrete Maths',
  topic: null,
  subtopic: null,
  priority: 'HIGH',
  plannedStartDate: '2026-10-01T00:00:00.000Z',
  dueDate: '2026-10-10T00:00:00.000Z',
  estimatedMinutes: 120,
  actualMinutes: 45,
  completed: false,
  completedAt: null,
  sortOrder: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  dateStatus: 'OVERDUE',
  daysUntilDue: -5,
  isOverdue: true,
  trackedMinutes: 45,
  attemptCount: 2,
  isBookmarked: false,
  bookmarkId: null,
  customValues: [],
  ...over,
});

const items = [
  makeItem({}),
  makeItem({ id: 'i2', name: 'Normalisation', subject: 'DBMS', dateStatus: 'UPCOMING', isOverdue: false, daysUntilDue: 3 }),
];

const makeCtx = (layout: TrackerLayout, over: Partial<LayoutContext> = {}): LayoutContext => ({
  tracker: makeTracker(layout),
  timeZone: 'Asia/Kolkata',
  customFields: [],
  busyItemId: null,
  onToggleComplete: vi.fn(),
  onToggleBookmark: vi.fn(),
  onOpen: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  ...over,
});

describe('tracker layouts show the same underlying items', () => {
  it('table, checklist and notes board all render every item', () => {
    const table = render(<TableLayout items={items} ctx={makeCtx('TABLE')} sort={{ sort: 'SORT_ORDER', direction: 'asc' }} onSort={() => {}} />);
    expect(table.getByText('Graph theory')).toBeInTheDocument();
    expect(table.getByText('Normalisation')).toBeInTheDocument();
    table.unmount();

    const list = render(<ChecklistLayout items={items} ctx={makeCtx('CHECKLIST')} />);
    expect(list.getByText('Graph theory')).toBeInTheDocument();
    expect(list.getByText('Normalisation')).toBeInTheDocument();
    list.unmount();

    const board = render(<NotesBoardLayout items={items} ctx={makeCtx('NOTES_BOARD')} />);
    expect(board.getByText('Graph theory')).toBeInTheDocument();
    expect(board.getByText('Normalisation')).toBeInTheDocument();
  });

  it('hides fields a layout cannot show instead of deleting the columns', () => {
    const tracker = makeTracker('NOTES_BOARD');
    const shown = columnsForLayout(tracker).map((column) => column.fieldKey);
    expect(shown).not.toContain('ESTIMATED_MINUTES');
    expect(shown).toContain('DESCRIPTION');
    // The column rows themselves are all still there.
    expect(tracker.columns).toHaveLength(FIELDS.length);
  });
});

describe('date status is a label, not a mutation', () => {
  it('shows an overdue item as overdue while keeping the original due date text', () => {
    render(<ChecklistLayout items={[items[0]!]} ctx={makeCtx('CHECKLIST')} />);
    expect(screen.getByText('5d overdue')).toBeInTheDocument();
  });

  it('renders the stored due date in the assessment time zone in the table', () => {
    render(<TableLayout items={[items[0]!]} ctx={makeCtx('TABLE')} sort={{ sort: 'SORT_ORDER', direction: 'asc' }} onSort={() => {}} />);
    expect(screen.getByText('10 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('5d overdue')).toBeInTheDocument();
  });
});

describe('interactions', () => {
  it('ticking a checkbox asks to toggle completion and nothing else', async () => {
    const ctx = makeCtx('CHECKLIST');
    render(<ChecklistLayout items={[items[0]!]} ctx={ctx} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /mark graph theory complete/i }));
    expect(ctx.onToggleComplete).toHaveBeenCalledTimes(1);
    expect(ctx.onOpen).not.toHaveBeenCalled();
  });

  it('bookmark button reflects state and does not open the row', async () => {
    const ctx = makeCtx('TABLE');
    render(
      <TableLayout
        items={[makeItem({ isBookmarked: true })]}
        ctx={ctx}
        sort={{ sort: 'SORT_ORDER', direction: 'asc' }}
        onSort={() => {}}
      />,
    );
    const button = screen.getByRole('button', { name: /remove graph theory from saved for later/i });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(button);
    expect(ctx.onToggleBookmark).toHaveBeenCalledTimes(1);
    expect(ctx.onOpen).not.toHaveBeenCalled();
  });

  it('clicking a sortable header reports the new sort', async () => {
    const onSort = vi.fn();
    render(<TableLayout items={items} ctx={makeCtx('TABLE')} sort={{ sort: 'SORT_ORDER', direction: 'asc' }} onSort={onSort} />);
    const header = screen.getByRole('columnheader', { name: /due/i });
    await userEvent.click(within(header).getByRole('button'));
    expect(onSort).toHaveBeenCalledWith({ sort: 'DUE_DATE', direction: 'asc' });
  });

  it('attempt dots show recorded attempts out of the configured slots', () => {
    render(<ChecklistLayout items={[items[0]!]} ctx={makeCtx('CHECKLIST')} />);
    expect(screen.getByText('2 of 4 attempt slots used')).toBeInTheDocument();
  });
});
