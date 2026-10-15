import { useState } from 'react';
import { toast } from 'sonner';
import { IMPLEMENTED_LAYOUTS, type TrackerLayout } from '@exampilot/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LAYOUT_META } from '@/lib/domain';
import { useTrackerMutations } from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { Tracker } from '@/lib/types';

export const NewTrackerDialog = ({
  open,
  onOpenChange,
  assessmentId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentId: string;
  onCreated: (tracker: Tracker) => void;
}) => {
  const { create } = useTrackerMutations(assessmentId);
  const [name, setName] = useState('');
  const [layout, setLayout] = useState<TrackerLayout>('TABLE');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New tracker</DialogTitle>
          <DialogDescription>You can change the layout later without losing any items.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!name.trim()) return;
            try {
              const tracker = await create.mutateAsync({ name: name.trim(), layout });
              toast.success('Tracker created');
              setName('');
              setLayout('TABLE');
              onOpenChange(false);
              onCreated(tracker);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Could not create the tracker');
            }
          }}
        >
          <div>
            <Label htmlFor="nt-name">Name</Label>
            <Input id="nt-name" autoFocus value={name} maxLength={200} onChange={(event) => setName(event.target.value)} placeholder="e.g. Weekly revision" />
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Layout</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {IMPLEMENTED_LAYOUTS.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  aria-pressed={layout === entry}
                  onClick={() => setLayout(entry)}
                  className={cn(
                    'rounded-md border p-3 text-left text-sm hover:bg-accent/50',
                    layout === entry ? 'border-primary bg-primary/5' : 'border-border',
                  )}
                >
                  <span className="block font-medium">{LAYOUT_META[entry].label}</span>
                  <span className="text-xs text-muted-foreground">{LAYOUT_META[entry].description}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              Create tracker
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
