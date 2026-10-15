import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { DENSITY_META } from '@/lib/domain';
import { cn } from '@/lib/utils';
import type { StudyItem } from '@/lib/types';
import { ItemMenu } from './item-menu';
import {
  BookmarkToggle,
  columnLabel,
  columnsForLayout,
  FieldValue,
  SORT_FOR_FIELD,
  type LayoutContext,
} from './shared';

export interface SortState {
  sort: string;
  direction: 'asc' | 'desc';
}

/**
 * Table layout. Wide content scrolls inside its own container so the page body
 * never scrolls sideways on a phone.
 */
export const TableLayout = ({
  items,
  ctx,
  sort,
  onSort,
}: {
  items: StudyItem[];
  ctx: LayoutContext;
  sort: SortState;
  onSort: (next: SortState) => void;
}) => {
  const { tracker } = ctx;
  const columns = columnsForLayout(tracker, 'TABLE');
  const density = DENSITY_META[tracker.density];

  const toggleSort = (key: string) =>
    onSort({ sort: key, direction: sort.sort === key && sort.direction === 'asc' ? 'desc' : 'asc' });

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <caption className="sr-only">{`${tracker.name} study items`}</caption>
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="w-10 px-3 py-2">
              <span className="sr-only">Done</span>
            </th>
            {columns.map((column) => {
              const sortKey = SORT_FOR_FIELD[column.fieldKey];
              const active = sortKey && sort.sort === sortKey;
              return (
                <th
                  key={column.id}
                  scope="col"
                  style={column.width ? { minWidth: Math.min(column.width, 320) } : undefined}
                  className="px-3 py-2 font-medium"
                  aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {sortKey ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground"
                      onClick={() => toggleSort(sortKey)}
                    >
                      {columnLabel(column, ctx.customFields)}
                      {active ? (
                        sort.direction === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-50" />
                      )}
                    </button>
                  ) : (
                    columnLabel(column, ctx.customFields)
                  )}
                </th>
              );
            })}
            <th scope="col" className="w-10 px-2 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className={cn(
                'cursor-pointer border-b border-border last:border-0 hover:bg-accent/40',
                item.completed && 'bg-muted/20',
              )}
              onClick={() => ctx.onOpen(item)}
            >
              <td className={cn('px-3', density.padding)} onClick={(event) => event.stopPropagation()}>
                <Checkbox
                  checked={item.completed}
                  disabled={ctx.busyItemId === item.id}
                  onCheckedChange={() => ctx.onToggleComplete(item)}
                  aria-label={`Mark ${item.name} ${item.completed ? 'incomplete' : 'complete'}`}
                />
              </td>
              {columns.map((column) => (
                <td key={column.id} className={cn('align-middle', density.padding)}>
                  {column.fieldKey === 'BOOKMARK' ? (
                    <BookmarkToggle item={item} onToggle={ctx.onToggleBookmark} disabled={ctx.busyItemId === item.id} />
                  ) : (
                    <FieldValue
                      item={item}
                      column={column}
                      timeZone={ctx.timeZone}
                      attemptSlots={tracker.viewConfig.attemptSlots}
                    />
                  )}
                </td>
              ))}
              <td className="px-1 text-right">
                <ItemMenu item={item} ctx={ctx} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
