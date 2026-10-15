import type { FieldKey, Priority, TrackerLayout } from '@exampilot/shared';
import { LAYOUT_SUPPORTED_FIELDS } from '@exampilot/shared';
import { Bookmark } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DATE_STATUS_META, FIELD_LABELS, PRIORITY_META } from '@/lib/domain';
import { dueLabel, formatDate, formatMinutes } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CustomField, StudyItem, Tracker, TrackerColumn } from '@/lib/types';

/** Everything a layout needs that is not the items themselves. */
export interface LayoutContext {
  tracker: Tracker;
  timeZone: string;
  customFields: CustomField[];
  /** True while a mutation is in flight for the row, to disable double clicks. */
  busyItemId: string | null;
  onToggleComplete: (item: StudyItem) => void;
  onToggleBookmark: (item: StudyItem) => void;
  onOpen: (item: StudyItem) => void;
  onEdit: (item: StudyItem) => void;
  onDelete: (item: StudyItem) => void;
  /** Present only when manual ordering is meaningful (no filters, manual sort). */
  onMove?: (item: StudyItem, direction: -1 | 1) => void;
}

export const PriorityBadge = ({ priority }: { priority: Priority }) => (
  <Badge className={cn('border-transparent', PRIORITY_META[priority].badge)}>{PRIORITY_META[priority].label}</Badge>
);

export const StatusBadge = ({ item }: { item: StudyItem }) => (
  <Badge className={cn('border-transparent', DATE_STATUS_META[item.dateStatus].badge)}>
    {DATE_STATUS_META[item.dateStatus].label}
  </Badge>
);

export const BookmarkToggle = ({
  item,
  onToggle,
  disabled,
}: {
  item: StudyItem;
  onToggle: (item: StudyItem) => void;
  disabled?: boolean;
}) => (
  <Button
    type="button"
    variant="ghost"
    size="icon-sm"
    disabled={disabled}
    aria-pressed={item.isBookmarked}
    aria-label={item.isBookmarked ? `Remove ${item.name} from Saved for Later` : `Save ${item.name} for later`}
    onClick={(event) => {
      event.stopPropagation();
      onToggle(item);
    }}
  >
    <Bookmark className={cn('size-4', item.isBookmarked && 'fill-primary text-primary')} />
  </Button>
);

/** Filled/empty dots showing how many of the configured attempt slots are used. */
export const AttemptDots = ({ count, slots }: { count: number; slots: number }) => {
  const shown = Math.max(slots, count);
  return (
    <span className="inline-flex items-center gap-1" title={`${count} attempt${count === 1 ? '' : 's'} recorded`}>
      {Array.from({ length: shown }).map((_, index) => (
        <span
          key={index}
          className={cn('size-2 rounded-full', index < count ? 'bg-primary' : 'border border-border bg-transparent')}
        />
      ))}
      <span className="sr-only">{`${count} of ${slots} attempt slots used`}</span>
    </span>
  );
};

export const DueCell = ({ item, timeZone }: { item: StudyItem; timeZone: string }) => {
  if (!item.dueDate) return <span className="text-muted-foreground">No due date</span>;
  return (
    <span className="flex flex-col leading-tight">
      <span>{formatDate(item.dueDate, timeZone)}</span>
      {!item.completed && (
        <span className={cn('text-xs', item.isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
          {dueLabel(item.daysUntilDue)}
        </span>
      )}
    </span>
  );
};

/** Fields a given layout can actually show. Others are hidden, never deleted. */
export const columnsForLayout = (tracker: Tracker, layout: TrackerLayout = tracker.layout): TrackerColumn[] => {
  const supported = LAYOUT_SUPPORTED_FIELDS[layout];
  return [...tracker.columns]
    .filter((column) => column.visible && supported.includes(column.fieldKey))
    .sort((a, b) => a.sortOrder - b.sortOrder);
};

export const columnLabel = (column: TrackerColumn, customFields: CustomField[]): string => {
  if (column.label) return column.label;
  if (column.fieldKey === 'CUSTOM') {
    return customFields.find((field) => field.id === column.customFieldId)?.label ?? 'Custom field';
  }
  return FIELD_LABELS[column.fieldKey];
};

/** Maps a column to the sort key the items API understands, if it has one. */
export const SORT_FOR_FIELD: Partial<Record<FieldKey, string>> = {
  NAME: 'NAME',
  PRIORITY: 'PRIORITY',
  PLANNED_START: 'PLANNED_START',
  DUE_DATE: 'DUE_DATE',
  ESTIMATED_MINUTES: 'ESTIMATED_MINUTES',
  ACTUAL_MINUTES: 'ACTUAL_MINUTES',
};

const customValueFor = (item: StudyItem, column: TrackerColumn): string | null =>
  item.customValues.find((entry) => entry.customFieldId === column.customFieldId)?.value ?? null;

/** One place that turns an item + column into display content, used by every layout. */
export const FieldValue = ({
  item,
  column,
  timeZone,
  attemptSlots,
}: {
  item: StudyItem;
  column: TrackerColumn;
  timeZone: string;
  attemptSlots: number;
}) => {
  const dash = <span className="text-muted-foreground">—</span>;
  switch (column.fieldKey) {
    case 'NAME':
      return <span className={cn('font-medium', item.completed && 'text-muted-foreground line-through')}>{item.name}</span>;
    case 'DESCRIPTION':
      return item.description ? <span className="line-clamp-2 text-muted-foreground">{item.description}</span> : dash;
    case 'SUBJECT':
      return item.subject ?? dash;
    case 'TOPIC':
      return item.topic ?? dash;
    case 'SUBTOPIC':
      return item.subtopic ?? dash;
    case 'PRIORITY':
      return <PriorityBadge priority={item.priority} />;
    case 'STATUS':
      return <StatusBadge item={item} />;
    case 'PLANNED_START':
      return item.plannedStartDate ? formatDate(item.plannedStartDate, timeZone) : dash;
    case 'DUE_DATE':
      return <DueCell item={item} timeZone={timeZone} />;
    case 'COMPLETED_AT':
      return item.completedAt ? formatDate(item.completedAt, timeZone) : dash;
    case 'ESTIMATED_MINUTES':
      return item.estimatedMinutes === null ? dash : formatMinutes(item.estimatedMinutes);
    case 'ACTUAL_MINUTES':
      return item.actualMinutes > 0 ? formatMinutes(item.actualMinutes) : dash;
    case 'ATTEMPTS':
      return <AttemptDots count={item.attemptCount} slots={attemptSlots} />;
    case 'CUSTOM':
      return customValueFor(item, column) ?? dash;
    // BOOKMARK is rendered as an interactive control by each layout.
    case 'BOOKMARK':
    case 'MOCK_TEST':
    default:
      return dash;
  }
};
