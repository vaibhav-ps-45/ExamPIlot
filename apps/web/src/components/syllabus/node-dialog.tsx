import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSyllabusMutation } from '@/lib/queries';
import type { SyllabusNode } from '@/lib/types';
import { descendantIds, flatten } from './tree';

export type NodeDialogState =
  | { mode: 'create'; parentId: string | null }
  | { mode: 'edit'; node: SyllabusNode }
  | null;

/** Create or edit a syllabus node. The parent picker can restructure the tree; the server rejects cycles. */
export const NodeDialog = ({
  state,
  onClose,
  assessmentId,
  tree,
}: {
  state: NodeDialogState;
  onClose: () => void;
  assessmentId: string;
  tree: SyllabusNode[];
}) => {
  const { create, update } = useSyllabusMutation(assessmentId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState('');
  const [parentId, setParentId] = useState('');

  useEffect(() => {
    if (!state) return;
    if (state.mode === 'edit') {
      setTitle(state.node.title);
      setDescription(state.node.description ?? '');
      setWeight(state.node.weight === null ? '' : String(state.node.weight));
      setParentId(state.node.parentId ?? '');
    } else {
      setTitle('');
      setDescription('');
      setWeight('');
      setParentId(state.parentId ?? '');
    }
  }, [state]);

  const parentOptions = useMemo(() => {
    const blocked = state?.mode === 'edit' ? new Set([state.node.id, ...descendantIds(state.node)]) : new Set<string>();
    return flatten(tree).filter(({ node }) => !blocked.has(node.id));
  }, [state, tree]);

  const weightValid = weight === '' || (/^\d+(\.\d+)?$/.test(weight) && Number(weight) <= 1000);
  const valid = title.trim().length > 0 && weightValid;
  const editing = state?.mode === 'edit';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!state || !valid) return;
    const payload = {
      title: title.trim(),
      description: description.trim() === '' ? null : description.trim(),
      weight: weight === '' ? null : Number(weight),
    };
    try {
      if (state.mode === 'edit') {
        await update.mutateAsync({ nodeId: state.node.id, ...payload, parentId: parentId || null });
        toast.success('Topic updated');
      } else {
        await create.mutateAsync({ ...payload, parentId: parentId || null });
        toast.success('Topic added');
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the topic');
    }
  };

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit topic' : 'Add topic'}</DialogTitle>
          <DialogDescription>
            Topics organise what you need to cover. Adding one never creates a task, date or reminder.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit} noValidate>
          <div>
            <Label htmlFor="node-title">Title</Label>
            <Input id="node-title" autoFocus value={title} maxLength={300} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="node-parent">Parent</Label>
            <NativeSelect id="node-parent" value={parentId} onChange={(event) => setParentId(event.target.value)}>
              <option value="">Top level</option>
              {parentOptions.map(({ node, depth }) => (
                <option key={node.id} value={node.id}>
                  {`${'\u00A0\u00A0'.repeat(depth)}${node.title}`}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <div>
              <Label htmlFor="node-desc">Notes (optional)</Label>
              <Textarea id="node-desc" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="node-weight">Weight (optional)</Label>
              <Input id="node-weight" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} aria-invalid={!weightValid} />
              {!weightValid && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  A number up to 1000.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || create.isPending || update.isPending}>
              {editing ? 'Save changes' : 'Add topic'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
