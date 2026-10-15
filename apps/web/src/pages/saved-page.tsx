import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { BOOKMARK_LABELS, BOOKMARK_TARGET_TYPES, type BookmarkLabel, type BookmarkTargetType } from '@exampilot/shared';
import { Bookmark as BookmarkIcon, BookOpen, CheckCircle2, ExternalLink, FileText, ListChecks, Pencil, Trash2, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states';
import { BOOKMARK_LABEL_META } from '@/lib/domain';
import { formatDate } from '@/lib/format';
import { useAssessments, useBookmarkMutations, useBookmarks } from '@/lib/queries';
import { useDebounced } from '@/hooks/use-debounced';
import { cn } from '@/lib/utils';
import type { Bookmark } from '@/lib/types';

const TYPE_META: Record<BookmarkTargetType, { label: string; icon: typeof ListChecks }> = {
  STUDY_ITEM: { label: 'Study item', icon: ListChecks },
  SYLLABUS_TOPIC: { label: 'Syllabus topic', icon: BookOpen },
  NOTE: { label: 'Note', icon: FileText },
  MOCK_TEST: { label: 'Mock test', icon: Trophy },
};

const labelText = (bookmark: Bookmark) =>
  bookmark.label === 'CUSTOM' && bookmark.customLabel ? bookmark.customLabel : BOOKMARK_LABEL_META[bookmark.label].label;

const EditBookmarkDialog = ({ bookmark, onClose }: { bookmark: Bookmark | null; onClose: () => void }) => {
  const { update } = useBookmarkMutations();
  const [label, setLabel] = useState<BookmarkLabel>('IMPORTANT');
  const [customLabel, setCustomLabel] = useState('');
  const [reason, setReason] = useState('');
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Load form values when a different bookmark opens.
  if (bookmark && bookmark.id !== loadedId) {
    setLoadedId(bookmark.id);
    setLabel(bookmark.label);
    setCustomLabel(bookmark.customLabel ?? '');
    setReason(bookmark.reason ?? '');
  }
  if (!bookmark && loadedId) setLoadedId(null);

  return (
    <Dialog open={Boolean(bookmark)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit saved item</DialogTitle>
          <DialogDescription>{bookmark?.title}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!bookmark) return;
            try {
              await update.mutateAsync({
                id: bookmark.id,
                label,
                customLabel: label === 'CUSTOM' && customLabel.trim() ? customLabel.trim() : null,
                reason: reason.trim() || null,
              });
              toast.success('Saved item updated');
              onClose();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Could not update');
            }
          }}
        >
          <div>
            <Label htmlFor="bm-label">Label</Label>
            <NativeSelect id="bm-label" value={label} onChange={(event) => setLabel(event.target.value as BookmarkLabel)}>
              {BOOKMARK_LABELS.map((entry) => (
                <option key={entry} value={entry}>
                  {BOOKMARK_LABEL_META[entry].label}
                </option>
              ))}
            </NativeSelect>
          </div>
          {label === 'CUSTOM' && (
            <div>
              <Label htmlFor="bm-custom">Your label</Label>
              <Input id="bm-custom" value={customLabel} maxLength={80} onChange={(event) => setCustomLabel(event.target.value)} />
            </div>
          )}
          <div>
            <Label htmlFor="bm-reason">Why did you save this? (optional)</Label>
            <Textarea id="bm-reason" rows={3} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const SavedPage = () => {
  const [assessmentId, setAssessmentId] = useState('');
  const [targetType, setTargetType] = useState('');
  const [label, setLabel] = useState('');
  const [subject, setSubject] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Bookmark | null>(null);
  const debouncedSubject = useDebounced(subject, 300);

  const assessments = useAssessments();
  const zones = useMemo(
    () => new Map((assessments.data ?? []).map((assessment) => [assessment.id, assessment] as const)),
    [assessments.data],
  );

  const bookmarks = useBookmarks({
    page,
    pageSize: 25,
    assessmentId: assessmentId || undefined,
    targetType: targetType || undefined,
    label: label || undefined,
    subject: debouncedSubject.trim() || undefined,
  });
  const { remove } = useBookmarkMutations();

  const filtered = Boolean(assessmentId || targetType || label || debouncedSubject.trim());
  const reset = () => {
    setAssessmentId('');
    setTargetType('');
    setLabel('');
    setSubject('');
    setPage(1);
  };
  const change = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setter(event.target.value);
    setPage(1);
  };

  const items = bookmarks.data?.items ?? [];
  const total = bookmarks.data?.total ?? 0;
  const pageSize = bookmarks.data?.pageSize ?? 25;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Saved for later</h1>
        <p className="text-sm text-muted-foreground">
          Everything you bookmarked, across assessments. Removing a bookmark never deletes the item itself.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect className="w-auto" aria-label="Assessment" value={assessmentId} onChange={change(setAssessmentId)}>
          <option value="">All assessments</option>
          {(assessments.data ?? []).map((assessment) => (
            <option key={assessment.id} value={assessment.id}>
              {assessment.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect className="w-auto" aria-label="Item type" value={targetType} onChange={change(setTargetType)}>
          <option value="">All types</option>
          {BOOKMARK_TARGET_TYPES.map((type) => (
            <option key={type} value={type}>
              {TYPE_META[type].label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect className="w-auto" aria-label="Label" value={label} onChange={change(setLabel)}>
          <option value="">All labels</option>
          {BOOKMARK_LABELS.map((entry) => (
            <option key={entry} value={entry}>
              {BOOKMARK_LABEL_META[entry].label}
            </option>
          ))}
        </NativeSelect>
        <Input
          className="w-44"
          aria-label="Filter by subject"
          placeholder="Subject (exact)"
          value={subject}
          onChange={change(setSubject)}
        />
        {filtered && (
          <Button variant="ghost" size="sm" onClick={reset}>
            Clear filters
          </Button>
        )}
      </div>

      {bookmarks.isLoading ? (
        <ListSkeleton rows={5} />
      ) : bookmarks.error ? (
        <ErrorState error={bookmarks.error} onRetry={() => void bookmarks.refetch()} />
      ) : items.length === 0 ? (
        filtered ? (
          <EmptyState title="Nothing saved matches these filters" action={<Button variant="outline" onClick={reset}>Clear filters</Button>} />
        ) : (
          <EmptyState
            icon={<BookmarkIcon className="size-5" />}
            title="Nothing saved yet"
            description="Use the bookmark button on any study item to keep it here for later, with an optional label and reason."
          />
        )
      ) : (
        <ul className="grid gap-3">
          {items.map((bookmark) => {
            const meta = TYPE_META[bookmark.targetType];
            const Icon = meta.icon;
            const assessment = bookmark.assessmentId ? zones.get(bookmark.assessmentId) : undefined;
            return (
              <li key={bookmark.id}>
                <Card>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className={cn('text-sm font-semibold', bookmark.completed && 'text-muted-foreground line-through')}>
                          {bookmark.title}
                        </h2>
                        <Badge className={cn('border-transparent', BOOKMARK_LABEL_META[bookmark.label].badge)}>{labelText(bookmark)}</Badge>
                        {bookmark.completed && (
                          <span className="inline-flex items-center gap-1 text-xs text-success">
                            <CheckCircle2 className="size-3.5" /> Done
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {[meta.label, assessment?.name, bookmark.subject, bookmark.dueDate && assessment ? `Due ${formatDate(bookmark.dueDate, assessment.timeZone)}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {bookmark.reason && <p className="text-sm text-muted-foreground">{bookmark.reason}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button asChild variant="outline" size="sm">
                        <Link to={bookmark.contextPath}>
                          <ExternalLink /> Open
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${bookmark.title}`} onClick={() => setEditing(bookmark)}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${bookmark.title} from saved`}
                        title="Remove from saved (the item itself is kept)"
                        onClick={async () => {
                          try {
                            await remove.mutateAsync(bookmark.id);
                            toast.success('Removed from saved. The item itself is unchanged.');
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : 'Could not remove');
                          }
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {total > pageSize && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{`${total} saved · page ${page} of ${totalPages}`}</span>
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

      <EditBookmarkDialog bookmark={editing} onClose={() => setEditing(null)} />
    </div>
  );
};
