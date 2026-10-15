import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStudyItemMutations, useTrackers } from '@/lib/queries';
import type { SyllabusNode } from '@/lib/types';

/** Creates a study item linked to a topic. No dates and no reminders are set. */
export const NodeItemDialog = ({
  node,
  subject,
  assessmentId,
  onClose,
}: {
  node: SyllabusNode | null;
  subject: string | null;
  assessmentId: string;
  onClose: () => void;
}) => {
  const { create } = useStudyItemMutations(assessmentId);
  const trackers = useTrackers(assessmentId);
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('');
  const [trackerId, setTrackerId] = useState('');

  useEffect(() => {
    if (node) {
      setName(node.title);
      setMinutes('');
      setTrackerId(trackers.data?.find((tracker) => tracker.isDefault)?.id ?? trackers.data?.[0]?.id ?? '');
    }
  }, [node, trackers.data]);

  const minutesValid = /^\d{0,6}$/.test(minutes);

  return (
    <Dialog open={Boolean(node)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a study item</DialogTitle>
          <DialogDescription>{`Linked to "${node?.title ?? ''}". You decide the dates later; nothing is scheduled for you.`}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!node || !name.trim() || !minutesValid) return;
            try {
              await create.mutateAsync({
                name: name.trim(),
                syllabusNodeId: node.id,
                subject,
                estimatedMinutes: minutes === '' ? null : Number(minutes),
                trackerId: trackerId || null,
              });
              toast.success('Study item added');
              onClose();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Could not add the item');
            }
          }}
        >
          <div>
            <Label htmlFor="ni-name">Name</Label>
            <Input id="ni-name" autoFocus value={name} maxLength={300} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ni-min">Estimated minutes (optional)</Label>
              <Input id="ni-min" inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} aria-invalid={!minutesValid} />
            </div>
            <div>
              <Label htmlFor="ni-tracker">Tracker</Label>
              <NativeSelect id="ni-tracker" value={trackerId} onChange={(event) => setTrackerId(event.target.value)}>
                <option value="">None</option>
                {(trackers.data ?? []).map((tracker) => (
                  <option key={tracker.id} value={tracker.id}>
                    {tracker.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || !minutesValid || create.isPending}>
              Add item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
