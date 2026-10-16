import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Bookmark, FileText, Pin, PinOff, Plus, Save, Search, Trash2 } from 'lucide-react';
import { AssessmentGate } from '@/components/layout/app-shell';
import { flatten } from '@/components/syllabus/tree';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states';
import { useDebounced } from '@/hooks/use-debounced';
import { formatDate } from '@/lib/format';
import { useBookmarkMutations, useNoteMutations, useNotes, useStudyItems, useSyllabus } from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { Assessment, Note } from '@/lib/types';

export const NotesPage = () => (
  <AssessmentGate title="notes">
    {(assessment) => <NotesContent assessment={assessment} />}
  </AssessmentGate>
);

interface Draft {
  title: string;
  body: string;
  studyItemId: string;
  syllabusNodeId: string;
}

const draftOf = (note: Note | null): Draft => ({
  title: note?.title ?? '',
  body: note?.body ?? '',
  studyItemId: note?.studyItemId ?? '',
  syllabusNodeId: note?.syllabusNodeId ?? '',
});

const sameDraft = (a: Draft, b: Draft) =>
  a.title === b.title && a.body === b.body && a.studyItemId === b.studyItemId && a.syllabusNodeId === b.syllabusNodeId;

const NoteEditor = ({
  assessment,
  note,
  onSaved,
  onClose,
  onDeleted,
}: {
  assessment: Assessment;
  /** null means a brand-new, unsaved note. */
  note: Note | null;
  onSaved: (note: Note) => void;
  onClose: () => void;
  onDeleted: () => void;
}) => {
  const { create, update, remove } = useNoteMutations(assessment.id);
  const bookmarks = useBookmarkMutations();
  const items = useStudyItems(assessment.id, { pageSize: 100, sort: 'NAME' });
  const syllabus = useSyllabus(assessment.id);
  const topics = useMemo(() => flatten(syllabus.data ?? []), [syllabus.data]);

  const saved = useMemo(() => draftOf(note), [note]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Switching notes loads that note; it never carries one note's text into another.
  useEffect(() => setDraft(saved), [saved, note?.id]);

  const dirty = !sameDraft(draft, saved);
  const valid = draft.title.trim().length > 0;
  const busy = create.isPending || update.isPending;

  const save = async () => {
    if (!valid || busy) return;
    try {
      if (note) {
        const patch: Record<string, unknown> = {};
        if (draft.title.trim() !== saved.title) patch.title = draft.title.trim();
        if (draft.body !== saved.body) patch.body = draft.body;
        if (draft.studyItemId !== saved.studyItemId) patch.studyItemId = draft.studyItemId || null;
        if (draft.syllabusNodeId !== saved.syllabusNodeId) patch.syllabusNodeId = draft.syllabusNodeId || null;
        onSaved(await update.mutateAsync({ id: note.id, ...patch }));
      } else {
        onSaved(
          await create.mutateAsync({
            title: draft.title.trim(),
            body: draft.body,
            studyItemId: draft.studyItemId || null,
            syllabusNodeId: draft.syllabusNodeId || null,
          }),
        );
      }
      toast.success('Note saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the note');
    }
  };

  const togglePin = async () => {
    if (!note) return;
    try {
      onSaved(await update.mutateAsync({ id: note.id, pinned: !note.pinned }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the note');
    }
  };

  const toggleBookmark = async () => {
    if (!note) return;
    try {
      if (note.bookmarkId) await bookmarks.remove.mutateAsync(note.bookmarkId);
      else await bookmarks.create.mutateAsync({ targetType: 'NOTE', noteId: note.id, label: 'IMPORTANT' });
      toast.success(note.bookmarkId ? 'Removed from saved' : 'Saved for later');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the bookmark');
    }
  };

  return (
    <div
      className="space-y-4"
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          void save();
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={onClose}>
          <ArrowLeft /> Notes
        </Button>
        <p className="text-xs text-muted-foreground">
          {note ? `Edited ${formatDate(note.updatedAt, assessment.timeZone)}` : 'New note'}
          {dirty && <span className="ml-2 font-medium text-warning">Unsaved changes</span>}
        </p>
        <div className="ml-auto flex items-center gap-1">
          {note && (
            <>
              <Button variant="ghost" size="icon-sm" aria-pressed={note.pinned} aria-label={note.pinned ? 'Unpin note' : 'Pin note'} onClick={() => void togglePin()}>
                {note.pinned ? <PinOff /> : <Pin />}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-pressed={note.isBookmarked}
                aria-label={note.isBookmarked ? 'Remove from Saved for Later' : 'Save for later'}
                onClick={() => void toggleBookmark()}
              >
                <Bookmark className={cn(note.isBookmarked && 'fill-primary text-primary')} />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Delete note" onClick={() => setConfirmDelete(true)}>
                <Trash2 />
              </Button>
            </>
          )}
          <Button onClick={() => void save()} disabled={!valid || !dirty || busy}>
            <Save /> Save
          </Button>
        </div>
      </div>

      <div>
        <Label htmlFor="note-title">Title</Label>
        <Input id="note-title" value={draft.title} maxLength={300} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
      </div>
      <div>
        <Label htmlFor="note-body">Note</Label>
        <Textarea id="note-body" rows={14} value={draft.body} maxLength={50000} onChange={(event) => setDraft({ ...draft, body: event.target.value })} className="font-mono text-sm" />
        <p className="mt-1 text-right text-xs text-muted-foreground">{`${draft.body.length.toLocaleString()} / 50,000`}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="note-item">Linked study item</Label>
          <NativeSelect id="note-item" value={draft.studyItemId} onChange={(event) => setDraft({ ...draft, studyItemId: event.target.value })}>
            <option value="">None</option>
            {(items.data?.items ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="note-topic">Linked syllabus topic</Label>
          <NativeSelect id="note-topic" value={draft.syllabusNodeId} onChange={(event) => setDraft({ ...draft, syllabusNodeId: event.target.value })}>
            <option value="">None</option>
            {topics.map(({ node, depth }) => (
              <option key={node.id} value={node.id}>
                {`${'\u00A0\u00A0'.repeat(depth)}${node.title}`}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${note?.title ?? ''}"?`}
        description="This note is deleted for good. The study item or topic it was linked to is not affected."
        confirmLabel="Delete note"
        onConfirm={async () => {
          if (note) {
            try {
              await remove.mutateAsync(note.id);
              toast.success('Note deleted');
              onDeleted();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Could not delete the note');
            }
          }
          setConfirmDelete(false);
        }}
      />
    </div>
  );
};

const NotesContent = ({ assessment }: { assessment: Assessment }) => {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('note');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const debounced = useDebounced(search, 300);

  const notes = useNotes(assessment.id, {
    pageSize: 100,
    search: debounced.trim() || undefined,
    pinned: pinnedOnly ? 'true' : undefined,
  });
  const list = useMemo(() => notes.data?.items ?? [], [notes.data]);
  const selected = list.find((entry) => entry.id === selectedId) ?? null;

  const select = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('note', id);
    else next.delete('note');
    setParams(next, { replace: true });
    setCreating(false);
  };

  const editorOpen = creating || Boolean(selectedId);
  const filtered = Boolean(debounced.trim() || pinnedOnly);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
          <p className="text-sm text-muted-foreground">Write things down for this assessment. Link a note to an item or topic if it helps.</p>
        </div>
        <Button onClick={() => { select(null); setCreating(true); }}>
          <Plus /> New note
        </Button>
      </header>

      <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
        <section aria-label="Note list" className={cn('space-y-3', editorOpen && 'hidden lg:block')}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input className="pl-8" type="search" placeholder="Search notes" aria-label="Search notes" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={pinnedOnly} onChange={(event) => setPinnedOnly(event.target.checked)} className="size-4 accent-primary" />
            Pinned only
          </label>

          {notes.isLoading ? (
            <ListSkeleton rows={5} />
          ) : notes.error ? (
            <ErrorState error={notes.error} onRetry={() => void notes.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={<FileText className="size-5" />}
              title={filtered ? 'No notes match' : 'No notes yet'}
              description={filtered ? 'Try a different search.' : 'Create one with the New note button.'}
            />
          ) : (
            <ul className="space-y-2">
              {list.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => select(entry.id)}
                    aria-current={entry.id === selectedId ? 'true' : undefined}
                    className={cn(
                      'w-full rounded-lg border bg-card p-3 text-left hover:bg-accent/40',
                      entry.id === selectedId ? 'border-primary' : 'border-border',
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {entry.pinned && <Pin className="size-3 text-primary" aria-label="Pinned" />}
                      <span className="truncate">{entry.title}</span>
                      {entry.isBookmarked && <Bookmark className="size-3 shrink-0 fill-primary text-primary" aria-label="Saved" />}
                    </span>
                    {entry.excerpt && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{entry.excerpt}</span>}
                    <span className="mt-1 block text-[11px] text-muted-foreground">{formatDate(entry.updatedAt, assessment.timeZone)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Note editor" className={cn(!editorOpen && 'hidden lg:block')}>
          {creating ? (
            <NoteEditor key="new" assessment={assessment} note={null} onSaved={(created) => select(created.id)} onClose={() => select(null)} onDeleted={() => select(null)} />
          ) : selectedId ? (
            notes.isLoading ? (
              <ListSkeleton rows={3} />
            ) : selected ? (
              <NoteEditor key={selected.id} assessment={assessment} note={selected} onSaved={() => undefined} onClose={() => select(null)} onDeleted={() => select(null)} />
            ) : (
              <EmptyState title="That note is not in this list" description="It may have been deleted, or it is hidden by your search." action={<Button variant="outline" onClick={() => { setSearch(''); setPinnedOnly(false); select(null); }}>Back to all notes</Button>} />
            )
          ) : (
            <EmptyState icon={<FileText className="size-5" />} title="Pick a note" description="Choose one from the list, or start a new one." />
          )}
        </section>
      </div>
    </div>
  );
};
