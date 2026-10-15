import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useSyllabusMutation, useSyllabusTemplates, useTrackers } from '@/lib/queries';
import { cn } from '@/lib/utils';

/**
 * Optional, explicit syllabus import. It states plainly what it will and will
 * not create, because "import" must never quietly schedule anything.
 */
export const ImportTemplateDialog = ({
  open,
  onOpenChange,
  assessmentId,
  existingNodeCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentId: string;
  existingNodeCount: number;
}) => {
  const templates = useSyllabusTemplates();
  const trackers = useTrackers(assessmentId);
  const { importTemplate } = useSyllabusMutation(assessmentId);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [createItems, setCreateItems] = useState(false);
  const [trackerId, setTrackerId] = useState('');

  const selected = templateId ?? templates.data?.[0]?.id ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import a syllabus template</DialogTitle>
          <DialogDescription>Templates are optional starting points. You can edit everything after importing.</DialogDescription>
        </DialogHeader>

        {templates.isLoading ? (
          <LoadingState />
        ) : templates.error ? (
          <ErrorState error={templates.error} onRetry={() => void templates.refetch()} />
        ) : (
          <div className="grid gap-4">
            <div role="radiogroup" aria-label="Template" className="grid gap-2">
              {(templates.data ?? []).map((template) => (
                <button
                  key={template.id}
                  type="button"
                  role="radio"
                  aria-checked={selected === template.id}
                  onClick={() => setTemplateId(template.id)}
                  className={cn(
                    'rounded-md border p-3 text-left text-sm hover:bg-accent/50',
                    selected === template.id ? 'border-primary bg-primary/5' : 'border-border',
                  )}
                >
                  <span className="block font-medium">{template.name}</span>
                  <span className="text-xs text-muted-foreground">{`${template.description} · ${template.nodeCount} topics`}</span>
                </button>
              ))}
            </div>

            {existingNodeCount > 0 && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                {`You already have ${existingNodeCount} topics. Importing adds to them, it does not replace or merge with them.`}
              </p>
            )}

            <label className="flex items-start gap-2 text-sm">
              <Checkbox className="mt-0.5" checked={createItems} onCheckedChange={(checked) => setCreateItems(checked === true)} />
              <span>
                Also create a study item for each topic
                <span className="block text-xs text-muted-foreground">
                  Items start with no dates and no reminders. Their subject is the topic's parent.
                </span>
              </span>
            </label>

            {createItems && (trackers.data?.length ?? 0) > 0 && (
              <div>
                <Label htmlFor="imp-tracker">Put the items in a tracker</Label>
                <NativeSelect id="imp-tracker" value={trackerId} onChange={(event) => setTrackerId(event.target.value)}>
                  <option value="">No tracker (still visible under All items)</option>
                  {(trackers.data ?? []).map((tracker) => (
                    <option key={tracker.id} value={tracker.id}>
                      {tracker.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selected || importTemplate.isPending}
            onClick={async () => {
              if (!selected) return;
              try {
                const result = await importTemplate.mutateAsync({
                  templateId: selected,
                  createStudyItems: createItems,
                  trackerId: createItems && trackerId ? trackerId : null,
                });
                toast.success(
                  `Imported ${result.importedNodes} topics${createItems ? ` and ${result.importedItems} items` : ''}. No dates or reminders were created.`,
                );
                onOpenChange(false);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Import failed');
              }
            }}
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
