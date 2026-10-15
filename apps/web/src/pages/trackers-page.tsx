import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  BookmarkCheck,
  KanbanSquare,
  LayoutGrid,
  ListChecks,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  StickyNote,
  Table2,
  Trash2,
} from 'lucide-react';
import { IMPLEMENTED_LAYOUTS, PRIORITIES, type TrackerLayout } from '@exampilot/shared';
import { AssessmentGate } from '@/components/layout/app-shell';
import { ChecklistLayout, QuickAdd } from '@/components/trackers/checklist-layout';
import { ItemDetailDialog } from '@/components/trackers/item-detail-dialog';
import { ItemFormDialog } from '@/components/trackers/item-form-dialog';
import { NewTrackerDialog } from '@/components/trackers/new-tracker-dialog';
import { NotesBoardLayout } from '@/components/trackers/notes-board-layout';
import type { LayoutContext } from '@/components/trackers/shared';
import { TableLayout, type SortState } from '@/components/trackers/table-layout';
import { TrackerSettingsDialog } from '@/components/trackers/tracker-settings-dialog';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input, NativeSelect } from '@/components/ui/input';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states';
import { useDebounced } from '@/hooks/use-debounced';
import { LAYOUT_META, PRIORITY_META } from '@/lib/domain';
import {
  useCustomFields,
  useStudyItemMutations,
  useStudyItems,
  useTrackerMutations,
  useTrackerViews,
  useTrackers,
} from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { Assessment, CustomField, SavedView, StudyItem, Tracker } from '@/lib/types';

const PAGE_SIZE = 100;

const LAYOUT_ICON: Record<TrackerLayout, typeof Table2> = {
  TABLE: Table2,
  CHECKLIST: ListChecks,
  NOTES_BOARD: StickyNote,
  KANBAN: KanbanSquare,
};

type StatusFilter = 'all' | 'open' | 'done';

interface Filters {
  search: string;
  priority: string;
  status: StatusFilter;
  scope: 'tracker' | 'all';
  sort: SortState;
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  priority: '',
  status: 'all',
  scope: 'tracker',
  sort: { sort: 'SORT_ORDER', direction: 'asc' },
};

const SORT_OPTIONS = [
  ['SORT_ORDER', 'Manual order'],
  ['NAME', 'Name'],
  ['DUE_DATE', 'Due date'],
  ['PRIORITY', 'Priority'],
  ['PLANNED_START', 'Planned start'],
  ['ESTIMATED_MINUTES', 'Estimated time'],
  ['ACTUAL_MINUTES', 'Actual time'],
] as const;

const filtersAreDefault = (filters: Filters) =>
  !filters.search && !filters.priority && filters.status === 'all';

/** Turns a saved view back into the local filter state. Unknown values are ignored. */
const filtersFromView = (view: SavedView, current: Filters): Filters => {
  const stored = (view.filters ?? {}) as Record<string, unknown>;
  const sorts = (view.sorts ?? {}) as Record<string, unknown>;
  const priority = typeof stored.priority === 'string' && (PRIORITIES as readonly string[]).includes(stored.priority) ? stored.priority : '';
  const status: StatusFilter = stored.completed === true ? 'done' : stored.completed === false ? 'open' : 'all';
  const sortKey = typeof sorts.field === 'string' && SORT_OPTIONS.some(([key]) => key === sorts.field) ? sorts.field : 'SORT_ORDER';
  return {
    ...current,
    search: view.searchTerm ?? '',
    priority,
    status,
    sort: { sort: sortKey, direction: sorts.direction === 'desc' ? 'desc' : 'asc' },
  };
};

export const TrackersPage = () => (
  <AssessmentGate title="trackers">
    {(assessment) => <TrackersContent assessment={assessment} />}
  </AssessmentGate>
);

const TrackersContent = ({ assessment }: { assessment: Assessment }) => {
  const assessmentId = assessment.id;
  const timeZone = assessment.timeZone;
  const [params, setParams] = useSearchParams();

  const trackersQuery = useTrackers(assessmentId);
  const customFieldsQuery = useCustomFields(assessmentId);
  const trackers = useMemo(() => trackersQuery.data ?? [], [trackersQuery.data]);
  const customFields = useMemo(() => customFieldsQuery.data ?? [], [customFieldsQuery.data]);

  const selectedId = params.get('tracker');
  const tracker: Tracker | undefined = trackers.find((entry) => entry.id === selectedId) ?? trackers.find((entry) => entry.isDefault) ?? trackers[0];

  const selectTracker = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params);
      next.set('tracker', id);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const [newTrackerOpen, setNewTrackerOpen] = useState(false);

  if (trackersQuery.isLoading) return <ListSkeleton rows={6} />;
  if (trackersQuery.error) return <ErrorState error={trackersQuery.error} onRetry={() => void trackersQuery.refetch()} />;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trackers</h1>
          <p className="text-sm text-muted-foreground">
            Different views of the same study items. Nothing here changes a date or creates a reminder on its own.
          </p>
        </div>
        <Button onClick={() => setNewTrackerOpen(true)}>
          <Plus /> New tracker
        </Button>
      </header>

      {trackers.length === 0 || !tracker ? (
        <EmptyState
          icon={<LayoutGrid className="size-5" />}
          title="No trackers yet"
          description="A tracker is a customizable view of your study items. Start with a table, a checklist or a notes board."
          action={
            <Button onClick={() => setNewTrackerOpen(true)}>
              <Plus /> Create your first tracker
            </Button>
          }
        />
      ) : (
        <>
          <nav aria-label="Trackers" className="flex gap-1 overflow-x-auto border-b border-border">
            {trackers.map((entry) => {
              const Icon = LAYOUT_ICON[entry.layout];
              const active = entry.id === tracker.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => selectTracker(entry.id)}
                  className={cn(
                    '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors',
                    active ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" style={entry.accentColor ? { color: entry.accentColor } : undefined} />
                  {entry.name}
                  <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{entry.itemCount}</span>
                </button>
              );
            })}
          </nav>

          <TrackerWorkspace
            key={tracker.id}
            assessmentId={assessmentId}
            timeZone={timeZone}
            tracker={tracker}
            trackers={trackers}
            customFields={customFields}
            onTrackerDeleted={() => {
              const next = new URLSearchParams(params);
              next.delete('tracker');
              setParams(next, { replace: true });
            }}
          />
        </>
      )}

      <NewTrackerDialog
        open={newTrackerOpen}
        onOpenChange={setNewTrackerOpen}
        assessmentId={assessmentId}
        onCreated={(created) => selectTracker(created.id)}
      />
    </div>
  );
};

const TrackerWorkspace = ({
  assessmentId,
  timeZone,
  tracker,
  trackers,
  customFields,
  onTrackerDeleted,
}: {
  assessmentId: string;
  timeZone: string;
  tracker: Tracker;
  trackers: Tracker[];
  customFields: CustomField[];
  onTrackerDeleted: () => void;
}) => {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(filters.search, 300);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [formState, setFormState] = useState<{ open: boolean; item: StudyItem | null }>({ open: false, item: null });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<StudyItem | null>(null);
  const [deletingTracker, setDeletingTracker] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [savingView, setSavingView] = useState(false);
  const [viewName, setViewName] = useState('');

  const { create, remove, reorder, toggleComplete, toggleBookmark } = useStudyItemMutations(assessmentId);
  const trackerMutations = useTrackerMutations(assessmentId, tracker.id);
  const viewsQuery = useTrackerViews(assessmentId, tracker.id);
  const views = viewsQuery.data ?? [];

  // Apply the default saved view once, when the workspace first opens.
  const appliedDefault = useRef(false);
  useEffect(() => {
    if (appliedDefault.current || !viewsQuery.data) return;
    appliedDefault.current = true;
    const def = viewsQuery.data.find((view) => view.isDefault);
    if (def) setFilters((current) => filtersFromView(def, current));
  }, [viewsQuery.data]);

  const query = {
    trackerId: filters.scope === 'tracker' ? tracker.id : undefined,
    search: debouncedSearch.trim() || undefined,
    priority: filters.priority || undefined,
    completed: filters.status === 'open' ? 'false' : filters.status === 'done' ? 'true' : undefined,
    sort: filters.sort.sort,
    direction: filters.sort.direction,
    page,
    pageSize: PAGE_SIZE,
  };
  const itemsQuery = useStudyItems(assessmentId, query);
  const rawItems = itemsQuery.data?.items ?? [];
  const total = itemsQuery.data?.total ?? 0;

  // "Show completed" is a display preference; an explicit Done filter overrides it.
  const items = useMemo(
    () => (tracker.viewConfig.showCompleted || filters.status === 'done' ? rawItems : rawItems.filter((item) => !item.completed)),
    [rawItems, tracker.viewConfig.showCompleted, filters.status],
  );

  const patchFilters = (patch: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const guard = async (itemId: string, action: () => Promise<unknown>, failure: string) => {
    setBusyItemId(itemId);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : failure);
    } finally {
      setBusyItemId(null);
    }
  };

  const canReorder =
    filters.scope === 'tracker' &&
    filters.sort.sort === 'SORT_ORDER' &&
    filters.sort.direction === 'asc' &&
    filtersAreDefault(filters) &&
    total <= PAGE_SIZE &&
    tracker.viewConfig.showCompleted;

  const ctx: LayoutContext = {
    tracker,
    timeZone,
    customFields,
    busyItemId,
    onToggleComplete: (item) =>
      void guard(item.id, () => toggleComplete.mutateAsync({ id: item.id, completed: !item.completed }), 'Could not update the item'),
    onToggleBookmark: (item) =>
      void guard(item.id, () => toggleBookmark.mutateAsync({ item, bookmarked: !item.isBookmarked }), 'Could not update the bookmark'),
    onOpen: (item) => setDetailId(item.id),
    onEdit: (item) => setFormState({ open: true, item }),
    onDelete: (item) => setDeletingItem(item),
    onMove: canReorder
      ? (item, direction) => {
          const ids = rawItems.map((entry) => entry.id);
          const index = ids.indexOf(item.id);
          const target = index + direction;
          if (index < 0 || target < 0 || target >= ids.length) return;
          [ids[index], ids[target]] = [ids[target]!, ids[index]!];
          void guard(item.id, () => reorder.mutateAsync(ids), 'Could not reorder');
        }
      : undefined,
  };

  const switchLayout = async (layout: TrackerLayout) => {
    if (layout === tracker.layout) return;
    try {
      const result = await trackerMutations.switchLayout.mutateAsync({ id: tracker.id, layout });
      toast.success(
        result.hiddenFields.length
          ? `Switched to ${LAYOUT_META[layout].label}. ${result.hiddenFields.length} column(s) are hidden here, not deleted.`
          : `Switched to ${LAYOUT_META[layout].label}. Your items are unchanged.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not switch layout');
    }
  };

  const saveCurrentView = async () => {
    const name = viewName.trim();
    if (!name) return;
    try {
      await trackerMutations.saveView.mutateAsync({
        id: tracker.id,
        name,
        layout: tracker.layout,
        density: tracker.density,
        filters: {
          ...(filters.priority ? { priority: filters.priority } : {}),
          ...(filters.status !== 'all' ? { completed: filters.status === 'done' } : {}),
        },
        sorts: { field: filters.sort.sort, direction: filters.sort.direction },
        searchTerm: filters.search.trim() || undefined,
        isDefault: false,
      });
      toast.success(`Saved view "${name}"`);
      setViewName('');
      setSavingView(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the view');
    }
  };

  const applyView = async (view: SavedView) => {
    setFilters((current) => filtersFromView(view, current));
    setPage(1);
    try {
      if (view.layout && view.layout !== tracker.layout && IMPLEMENTED_LAYOUTS.includes(view.layout)) {
        await trackerMutations.switchLayout.mutateAsync({ id: tracker.id, layout: view.layout });
      }
      if (view.density && view.density !== tracker.density) {
        await trackerMutations.update.mutateAsync({ id: tracker.id, density: view.density });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not restore the full view');
    }
  };

  // A plain function, not a nested component, so the layout is not remounted on every render.
  const renderLayout = () => {
    if (tracker.layout === 'TABLE') {
      return <TableLayout items={items} ctx={ctx} sort={filters.sort} onSort={(sort) => patchFilters({ sort })} />;
    }
    if (tracker.layout === 'CHECKLIST') return <ChecklistLayout items={items} ctx={ctx} />;
    return <NotesBoardLayout items={items} ctx={ctx} />;
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = !filtersAreDefault(filters);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            type="search"
            placeholder="Search this tracker"
            aria-label="Search items"
            value={filters.search}
            onChange={(event) => patchFilters({ search: event.target.value })}
          />
        </div>
        <NativeSelect className="w-auto" aria-label="Filter by priority" value={filters.priority} onChange={(event) => patchFilters({ priority: event.target.value })}>
          <option value="">Any priority</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_META[priority].label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect className="w-auto" aria-label="Filter by status" value={filters.status} onChange={(event) => patchFilters({ status: event.target.value as StatusFilter })}>
          <option value="all">All items</option>
          <option value="open">Open</option>
          <option value="done">Completed</option>
        </NativeSelect>
        <NativeSelect
          className="w-auto"
          aria-label="Sort by"
          value={filters.sort.sort}
          onChange={(event) => patchFilters({ sort: { sort: event.target.value, direction: 'asc' } })}
        >
          {SORT_OPTIONS.map(([key, label]) => (
            <option key={key} value={key}>{`Sort: ${label}`}</option>
          ))}
        </NativeSelect>
        <Button
          variant="outline"
          size="icon"
          aria-label={filters.sort.direction === 'asc' ? 'Sorted ascending, switch to descending' : 'Sorted descending, switch to ascending'}
          onClick={() => patchFilters({ sort: { ...filters.sort, direction: filters.sort.direction === 'asc' ? 'desc' : 'asc' } })}
        >
          <span aria-hidden="true">{filters.sort.direction === 'asc' ? '↑' : '↓'}</span>
        </Button>
        <NativeSelect className="w-auto" aria-label="Which items to show" value={filters.scope} onChange={(event) => patchFilters({ scope: event.target.value as Filters['scope'] })}>
          <option value="tracker">This tracker</option>
          <option value="all">All items in assessment</option>
        </NativeSelect>

        <div className="ml-auto flex items-center gap-2">
          <div role="group" aria-label="Layout" className="flex rounded-md border border-border p-0.5">
            {IMPLEMENTED_LAYOUTS.map((layout) => {
              const Icon = LAYOUT_ICON[layout];
              return (
                <Button
                  key={layout}
                  variant={tracker.layout === layout ? 'secondary' : 'ghost'}
                  size="icon-sm"
                  aria-pressed={tracker.layout === layout}
                  aria-label={`${LAYOUT_META[layout].label} layout`}
                  title={LAYOUT_META[layout].label}
                  onClick={() => void switchLayout(layout)}
                >
                  <Icon />
                </Button>
              );
            })}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <BookmarkCheck /> Views
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Saved views</DropdownMenuLabel>
              {views.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No saved views yet.</p>}
              {views.map((view) => (
                <div key={view.id} className="flex items-center">
                  <DropdownMenuItem className="flex-1" onSelect={() => void applyView(view)}>
                    {view.name}
                  </DropdownMenuItem>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete view ${view.name}`}
                    onClick={() => void trackerMutations.deleteView.mutateAsync({ id: tracker.id, viewId: view.id })}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSavingView(true)}>
                <Plus /> Save current view
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings2 /> Customize
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Tracker actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem destructive onSelect={() => setDeletingTracker(true)}>
                <Trash2 /> Delete tracker
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {savingView && (
        <form
          className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-2"
          onSubmit={(event) => {
            event.preventDefault();
            void saveCurrentView();
          }}
        >
          <Input
            autoFocus
            className="max-w-xs"
            placeholder="Name this view, e.g. High priority open"
            aria-label="View name"
            value={viewName}
            maxLength={120}
            onChange={(event) => setViewName(event.target.value)}
          />
          <Button type="submit" size="sm" disabled={!viewName.trim() || trackerMutations.saveView.isPending}>
            Save view
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSavingView(false)}>
            Cancel
          </Button>
          <span className="text-xs text-muted-foreground">Saves the layout, density, filters, sort and search.</span>
        </form>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <QuickAdd
            pending={create.isPending}
            onAdd={async (name) => {
              try {
                await create.mutateAsync({ name, trackerId: tracker.id });
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Could not add the item');
                throw error;
              }
            }}
          />
        </div>
        <Button onClick={() => setFormState({ open: true, item: null })}>
          <Plus /> New item
        </Button>
      </div>

      {itemsQuery.isLoading ? (
        <ListSkeleton rows={6} />
      ) : itemsQuery.error ? (
        <ErrorState error={itemsQuery.error} onRetry={() => void itemsQuery.refetch()} />
      ) : items.length === 0 ? (
        filtered ? (
          <EmptyState
            title="No items match these filters"
            description="Try a different search or clear the filters."
            action={<Button variant="outline" onClick={() => patchFilters({ search: '', priority: '', status: 'all' })}>Clear filters</Button>}
          />
        ) : (
          <EmptyState
            title={filters.scope === 'tracker' ? 'This tracker has no items yet' : 'No study items yet'}
            description="Add an item above, or import a syllabus template from the Syllabus page. Items you add here are not scheduled or reminded automatically."
            action={<Button onClick={() => setFormState({ open: true, item: null })}><Plus /> Add an item</Button>}
          />
        )
      ) : (
        renderLayout()
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{`${total} items · page ${page} of ${totalPages}`}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <TrackerSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        assessmentId={assessmentId}
        tracker={tracker}
        customFields={customFields}
      />

      <ItemFormDialog
        open={formState.open}
        onOpenChange={(open) => setFormState((current) => ({ ...current, open }))}
        assessmentId={assessmentId}
        timeZone={timeZone}
        item={formState.item}
        tracker={tracker}
        trackers={trackers}
        customFields={customFields}
      />

      <ItemDetailDialog
        assessmentId={assessmentId}
        itemId={detailId}
        timeZone={timeZone}
        attemptSlots={tracker.viewConfig.attemptSlots}
        onOpenChange={(open) => !open && setDetailId(null)}
        onEdit={(item) => {
          setDetailId(null);
          setFormState({ open: true, item });
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingItem)}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        title={`Delete "${deletingItem?.name ?? ''}"?`}
        description="The item, its practice attempts and its bookmark are removed. Logged study sessions are kept but no longer linked to it."
        confirmLabel="Delete item"
        onConfirm={async () => {
          if (deletingItem) {
            try {
              await remove.mutateAsync(deletingItem.id);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Could not delete the item');
            }
          }
          setDeletingItem(null);
        }}
      />

      <ConfirmDialog
        open={deletingTracker}
        onOpenChange={setDeletingTracker}
        title={`Delete the "${tracker.name}" tracker?`}
        description="Only the view is deleted. Its items stay in the assessment and remain available under All items."
        confirmLabel="Delete tracker"
        onConfirm={async () => {
          try {
            await trackerMutations.remove.mutateAsync(tracker.id);
            onTrackerDeleted();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not delete the tracker');
          }
          setDeletingTracker(false);
        }}
      />
    </div>
  );
};
