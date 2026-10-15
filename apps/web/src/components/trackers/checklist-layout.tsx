import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { DENSITY_META, PRIORITY_META } from '@/lib/domain';
import { dueLabel, formatMinutes } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { StudyItem } from '@/lib/types';
import { ItemMenu } from './item-menu';
import { AttemptDots, BookmarkToggle, columnsForLayout, type LayoutContext } from './shared';

/** Quick-add row: name only, everything else can be filled in later. */
export const QuickAdd = ({ onAdd, pending }: { onAdd: (name: string) => Promise<void>; pending: boolean }) => {
  const [name, setName] = useState('');
  return (
    <form
      className="flex gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        await onAdd(trimmed);
        setName('');
      }}
    >
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Add an item and press Enter"
        aria-label="New item name"
        maxLength={300}
      />
      <Button type="submit" variant="secondary" disabled={pending || !name.trim()}>
        <Plus /> Add
      </Button>
    </form>
  );
};

export const ChecklistLayout = ({ items, ctx }: { items: StudyItem[]; ctx: LayoutContext }) => {
  const { tracker } = ctx;
  const shown = new Set(columnsForLayout(tracker, 'CHECKLIST').map((column) => column.fieldKey));
  const density = DENSITY_META[tracker.density];

  const groups = useMemo(() => {
    if (!tracker.viewConfig.groupBySubject) return [{ title: null as string | null, items }];
    const map = new Map<string, StudyItem[]>();
    for (const item of items) {
      const key = item.subject ?? 'No subject';
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()].map(([title, group]) => ({ title, items: group }));
  }, [items, tracker.viewConfig.groupBySubject]);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.title ?? 'all'} aria-label={group.title ?? 'Items'}>
          {group.title && (
            <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title} <span className="font-normal">({group.items.length})</span>
            </h3>
          )}
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {group.items.map((item) => (
              <li
                key={item.id}
                className={cn('flex items-center gap-3 hover:bg-accent/40', density.padding)}
              >
                <Checkbox
                  checked={item.completed}
                  disabled={ctx.busyItemId === item.id}
                  onCheckedChange={() => ctx.onToggleComplete(item)}
                  aria-label={`Mark ${item.name} ${item.completed ? 'incomplete' : 'complete'}`}
                />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => ctx.onOpen(item)}>
                  <span className={cn('block truncate text-sm font-medium', item.completed && 'text-muted-foreground line-through')}>
                    {item.name}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {shown.has('SUBJECT') && item.subject && <span>{item.subject}</span>}
                    {shown.has('PRIORITY') && (
                      <span className="inline-flex items-center gap-1">
                        <span className={cn('size-1.5 rounded-full', PRIORITY_META[item.priority].dot)} />
                        {PRIORITY_META[item.priority].label}
                      </span>
                    )}
                    {shown.has('DUE_DATE') && item.dueDate && !item.completed && (
                      <span className={cn(item.isOverdue && 'font-medium text-destructive')}>{dueLabel(item.daysUntilDue)}</span>
                    )}
                    {shown.has('ESTIMATED_MINUTES') && item.estimatedMinutes !== null && (
                      <span>{`Est. ${formatMinutes(item.estimatedMinutes)}`}</span>
                    )}
                    {shown.has('ACTUAL_MINUTES') && item.actualMinutes > 0 && (
                      <span>{`Spent ${formatMinutes(item.actualMinutes)}`}</span>
                    )}
                    {shown.has('ATTEMPTS') && <AttemptDots count={item.attemptCount} slots={tracker.viewConfig.attemptSlots} />}
                  </span>
                </button>
                {shown.has('BOOKMARK') && (
                  <BookmarkToggle item={item} onToggle={ctx.onToggleBookmark} disabled={ctx.busyItemId === item.id} />
                )}
                <ItemMenu item={item} ctx={ctx} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
