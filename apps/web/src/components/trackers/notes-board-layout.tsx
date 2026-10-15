import { Checkbox } from '@/components/ui/checkbox';
import { DENSITY_META } from '@/lib/domain';
import { cn } from '@/lib/utils';
import type { StudyItem } from '@/lib/types';
import { ItemMenu } from './item-menu';
import { BookmarkToggle, columnsForLayout, DueCell, PriorityBadge, type LayoutContext } from './shared';

const COLUMN_CLASS: Record<number, string> = {
  1: 'sm:columns-1',
  2: 'sm:columns-2',
  3: 'sm:columns-2 lg:columns-3',
  4: 'sm:columns-2 lg:columns-4',
  5: 'sm:columns-2 lg:columns-3 xl:columns-5',
  6: 'sm:columns-2 lg:columns-3 xl:columns-6',
};

/** Sticky-note board. Same items as every other layout, shown as cards. */
export const NotesBoardLayout = ({ items, ctx }: { items: StudyItem[]; ctx: LayoutContext }) => {
  const { tracker } = ctx;
  const shown = new Set(columnsForLayout(tracker, 'NOTES_BOARD').map((column) => column.fieldKey));
  const density = DENSITY_META[tracker.density];
  const accent = tracker.accentColor ?? 'hsl(var(--primary))';

  return (
    <ul className={cn('columns-1 gap-3 [column-fill:_balance]', COLUMN_CLASS[tracker.viewConfig.notesBoardColumns] ?? 'sm:columns-2 lg:columns-3')}>
      {items.map((item) => (
        <li key={item.id} className="mb-3 break-inside-avoid">
          <article
            className={cn(
              'rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md',
              density.padding,
              item.completed && 'opacity-70',
            )}
            style={{ borderTopWidth: 4, borderTopColor: accent }}
          >
            <header className="flex items-start gap-2">
              <Checkbox
                className="mt-1"
                checked={item.completed}
                disabled={ctx.busyItemId === item.id}
                onCheckedChange={() => ctx.onToggleComplete(item)}
                aria-label={`Mark ${item.name} ${item.completed ? 'incomplete' : 'complete'}`}
              />
              <button
                type="button"
                className={cn('min-w-0 flex-1 text-left text-sm font-semibold', item.completed && 'line-through')}
                onClick={() => ctx.onOpen(item)}
              >
                {item.name}
              </button>
              {shown.has('BOOKMARK') && (
                <BookmarkToggle item={item} onToggle={ctx.onToggleBookmark} disabled={ctx.busyItemId === item.id} />
              )}
              <ItemMenu item={item} ctx={ctx} />
            </header>
            {shown.has('DESCRIPTION') && item.description && (
              <p className="mt-2 line-clamp-6 whitespace-pre-line text-sm text-muted-foreground">{item.description}</p>
            )}
            <footer className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {shown.has('SUBJECT') && item.subject && <span>{item.subject}</span>}
              {shown.has('PRIORITY') && <PriorityBadge priority={item.priority} />}
              {shown.has('DUE_DATE') && item.dueDate && <DueCell item={item} timeZone={ctx.timeZone} />}
            </footer>
          </article>
        </li>
      ))}
    </ul>
  );
};
