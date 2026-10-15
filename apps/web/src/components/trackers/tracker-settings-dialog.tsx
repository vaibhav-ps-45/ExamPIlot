import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  CUSTOM_FIELD_TYPES,
  DISPLAY_DENSITIES,
  FIELD_KEYS,
  IMPLEMENTED_LAYOUTS,
  LAYOUT_SUPPORTED_FIELDS,
  MAX_ATTEMPT_SLOTS,
  MIN_ATTEMPT_SLOTS,
  type FieldKey,
} from '@exampilot/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiError } from '@/lib/api';
import { ACCENT_OPTIONS, DENSITY_META, FIELD_LABELS, LAYOUT_META } from '@/lib/domain';
import { useCustomFieldMutations, useTrackerMutations } from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { CustomField, Tracker } from '@/lib/types';
import { columnLabel } from './shared';

const message = (error: unknown, fallback: string) => (error instanceof ApiError || error instanceof Error ? error.message : fallback);

const keyFromLabel = (label: string) => {
  const cleaned = label.trim().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return /^[a-zA-Z]/.test(cleaned) ? cleaned.slice(0, 60) : cleaned ? `f_${cleaned}`.slice(0, 60) : '';
};

const GeneralTab = ({ assessmentId, tracker }: { assessmentId: string; tracker: Tracker }) => {
  const { update, switchLayout } = useTrackerMutations(assessmentId, tracker.id);
  const [name, setName] = useState(tracker.name);
  const [slots, setSlots] = useState(String(tracker.viewConfig.attemptSlots));
  useEffect(() => {
    setName(tracker.name);
    setSlots(String(tracker.viewConfig.attemptSlots));
  }, [tracker.name, tracker.viewConfig.attemptSlots]);

  const save = async (input: Record<string, unknown>, success?: string) => {
    try {
      await update.mutateAsync({ id: tracker.id, ...input });
      if (success) toast.success(success);
    } catch (error) {
      toast.error(message(error, 'Could not save'));
    }
  };

  const setView = (patch: Record<string, unknown>) => save({ viewConfig: patch });

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="tr-name">Name</Label>
        <div className="flex gap-2">
          <Input id="tr-name" value={name} maxLength={200} onChange={(event) => setName(event.target.value)} />
          <Button
            variant="secondary"
            disabled={!name.trim() || name.trim() === tracker.name || update.isPending}
            onClick={() => save({ name: name.trim() }, 'Renamed')}
          >
            Save
          </Button>
        </div>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Layout</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {IMPLEMENTED_LAYOUTS.map((layout) => (
            <button
              key={layout}
              type="button"
              aria-pressed={tracker.layout === layout}
              onClick={async () => {
                if (layout === tracker.layout) return;
                try {
                  const result = await switchLayout.mutateAsync({ id: tracker.id, layout });
                  toast.success(
                    result.hiddenFields.length
                      ? `Switched. ${result.hiddenFields.length} column(s) are hidden in this layout, not deleted.`
                      : 'Layout switched. Your items are unchanged.',
                  );
                } catch (error) {
                  toast.error(message(error, 'Could not switch layout'));
                }
              }}
              className={cn(
                'rounded-md border p-3 text-left text-sm transition-colors hover:bg-accent/50',
                tracker.layout === layout ? 'border-primary bg-primary/5' : 'border-border',
              )}
            >
              <span className="block font-medium">{LAYOUT_META[layout].label}</span>
              <span className="text-xs text-muted-foreground">{LAYOUT_META[layout].description}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Accent colour</legend>
        <div className="flex flex-wrap gap-2">
          {ACCENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              title={option.label}
              aria-label={option.label}
              aria-pressed={tracker.accentColor === option.value}
              onClick={() => save({ accentColor: option.value })}
              className={cn(
                'size-7 rounded-full ring-offset-2 ring-offset-background',
                option.swatch,
                tracker.accentColor === option.value && 'ring-2 ring-foreground',
              )}
            />
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="tr-density">Density</Label>
          <NativeSelect id="tr-density" value={tracker.density} onChange={(event) => save({ density: event.target.value })}>
            {DISPLAY_DENSITIES.map((density) => (
              <option key={density} value={density}>
                {DENSITY_META[density].label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="tr-slots">Practice attempt slots</Label>
          <div className="flex gap-2">
            <Input id="tr-slots" inputMode="numeric" value={slots} onChange={(event) => setSlots(event.target.value)} />
            <Button
              variant="secondary"
              disabled={
                !/^\d+$/.test(slots) ||
                Number(slots) < MIN_ATTEMPT_SLOTS ||
                Number(slots) > MAX_ATTEMPT_SLOTS ||
                Number(slots) === tracker.viewConfig.attemptSlots
              }
              onClick={() => setView({ attemptSlots: Number(slots) })}
            >
              Save
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{`Between ${MIN_ATTEMPT_SLOTS} and ${MAX_ATTEMPT_SLOTS}.`}</p>
        </div>
      </div>

      <div className="space-y-2.5">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={tracker.viewConfig.showCompleted}
            onCheckedChange={(checked) => setView({ showCompleted: checked === true })}
          />
          Show completed items
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={tracker.viewConfig.groupBySubject}
            onCheckedChange={(checked) => setView({ groupBySubject: checked === true })}
          />
          Group checklist by subject
        </label>
        <div className="max-w-[14rem]">
          <Label htmlFor="tr-board-cols">Notes board columns</Label>
          <NativeSelect
            id="tr-board-cols"
            value={tracker.viewConfig.notesBoardColumns}
            onChange={(event) => setView({ notesBoardColumns: Number(event.target.value) })}
          >
            {[1, 2, 3, 4, 5, 6].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
    </div>
  );
};

const ColumnsTab = ({
  assessmentId,
  tracker,
  customFields,
}: {
  assessmentId: string;
  tracker: Tracker;
  customFields: CustomField[];
}) => {
  const { updateColumn, removeColumn, reorderColumns, addColumn } = useTrackerMutations(assessmentId, tracker.id);
  const supported = LAYOUT_SUPPORTED_FIELDS[tracker.layout];
  const columns = [...tracker.columns].sort((a, b) => a.sortOrder - b.sortOrder);
  const [adding, setAdding] = useState('');

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    try {
      await action();
    } catch (error) {
      toast.error(message(error, fallback));
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = [...columns];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    void run(() => reorderColumns.mutateAsync({ id: tracker.id, orderedIds: next.map((column) => column.id) }), 'Could not reorder');
  };

  const usedKeys = new Set(columns.filter((column) => column.fieldKey !== 'CUSTOM').map((column) => column.fieldKey));
  const usedCustom = new Set(columns.map((column) => column.customFieldId).filter(Boolean));
  const addable: Array<{ value: string; label: string }> = [
    ...FIELD_KEYS.filter((key): key is FieldKey => key !== 'CUSTOM' && !usedKeys.has(key) && supported.includes(key)).map((key) => ({
      value: `key:${key}`,
      label: FIELD_LABELS[key],
    })),
    ...(supported.includes('CUSTOM')
      ? customFields.filter((field) => !usedCustom.has(field.id)).map((field) => ({ value: `custom:${field.id}`, label: field.label }))
      : []),
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Columns control what each layout shows. Hiding a column never deletes the data behind it.
      </p>
      <ul className="space-y-2">
        {columns.map((column, index) => {
          const layoutOk = supported.includes(column.fieldKey);
          return (
            <li key={column.id} className="flex items-center gap-2 rounded-md border border-border p-2">
              <Checkbox
                checked={column.visible && layoutOk}
                disabled={!layoutOk}
                onCheckedChange={(checked) =>
                  run(() => updateColumn.mutateAsync({ id: tracker.id, columnId: column.id, visible: checked === true }), 'Could not update')
                }
                aria-label={`Show ${columnLabel(column, customFields)}`}
              />
              <Input
                className="h-8 flex-1"
                defaultValue={columnLabel(column, customFields)}
                aria-label={`Label for ${FIELD_LABELS[column.fieldKey]}`}
                maxLength={120}
                onBlur={(event) => {
                  const next = event.target.value.trim();
                  if (next && next !== columnLabel(column, customFields)) {
                    void run(() => updateColumn.mutateAsync({ id: tracker.id, columnId: column.id, label: next }), 'Could not rename');
                  }
                }}
              />
              {!layoutOk && <span className="hidden text-xs text-muted-foreground sm:inline">Not in this layout</span>}
              <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move column up">
                <ArrowUp />
              </Button>
              <Button variant="ghost" size="icon-sm" disabled={index === columns.length - 1} onClick={() => move(index, 1)} aria-label="Move column down">
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={column.fieldKey === 'NAME'}
                onClick={() => run(() => removeColumn.mutateAsync({ id: tracker.id, columnId: column.id }), 'Could not remove')}
                aria-label={`Remove ${columnLabel(column, customFields)} column`}
              >
                <Trash2 />
              </Button>
            </li>
          );
        })}
      </ul>

      {addable.length > 0 && (
        <div className="flex gap-2">
          <NativeSelect value={adding} onChange={(event) => setAdding(event.target.value)} aria-label="Column to add">
            <option value="">Add a column…</option>
            {addable.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
          <Button
            variant="secondary"
            disabled={!adding || addColumn.isPending}
            onClick={async () => {
              const [kind, id] = adding.split(':');
              await run(
                () =>
                  addColumn.mutateAsync(
                    kind === 'custom'
                      ? { id: tracker.id, fieldKey: 'CUSTOM', customFieldId: id }
                      : { id: tracker.id, fieldKey: id },
                  ),
                'Could not add the column',
              );
              setAdding('');
            }}
          >
            <Plus /> Add
          </Button>
        </div>
      )}
    </div>
  );
};

const CustomFieldsTab = ({ assessmentId, customFields }: { assessmentId: string; customFields: CustomField[] }) => {
  const { create, remove } = useCustomFieldMutations(assessmentId);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<(typeof CUSTOM_FIELD_TYPES)[number]>('TEXT');
  const [options, setOptions] = useState('');
  const [deleting, setDeleting] = useState<CustomField | null>(null);

  const key = keyFromLabel(label);
  const optionList = options.split(',').map((entry) => entry.trim()).filter(Boolean);
  const valid = label.trim().length > 0 && key.length > 0 && (type !== 'SELECT' || optionList.length > 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Custom fields belong to the whole assessment, so every tracker can show them. Add one as a column afterwards.
      </p>
      {customFields.length > 0 && (
        <ul className="space-y-2">
          {customFields.map((field) => (
            <li key={field.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
              <span>
                <span className="font-medium">{field.label}</span>{' '}
                <span className="text-muted-foreground">{`· ${field.type.toLowerCase()}${field.options.length ? ` (${field.options.join(', ')})` : ''}`}</span>
              </span>
              <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(field)} aria-label={`Delete ${field.label}`}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="grid gap-3 rounded-md border border-border p-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!valid) return;
          try {
            await create.mutateAsync({ key, label: label.trim(), type, options: type === 'SELECT' ? optionList : [], required: false });
            toast.success('Custom field added');
            setLabel('');
            setOptions('');
            setType('TEXT');
          } catch (error) {
            toast.error(message(error, 'Could not add the field'));
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="cf-label">Label</Label>
            <Input id="cf-label" value={label} maxLength={120} onChange={(event) => setLabel(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="cf-type">Type</Label>
            <NativeSelect id="cf-type" value={type} onChange={(event) => setType(event.target.value as typeof type)}>
              {CUSTOM_FIELD_TYPES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry.charAt(0) + entry.slice(1).toLowerCase()}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        {type === 'SELECT' && (
          <div>
            <Label htmlFor="cf-options">Options (comma separated)</Label>
            <Input id="cf-options" value={options} onChange={(event) => setOptions(event.target.value)} placeholder="Notes, Video, Book" />
          </div>
        )}
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" disabled={!valid || create.isPending}>
            <Plus /> Add field
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.label ?? ''}"?`}
        description="The field and the values stored for it on every item are removed. This cannot be undone."
        confirmLabel="Delete field"
        onConfirm={async () => {
          if (deleting) {
            try {
              await remove.mutateAsync(deleting.id);
            } catch (error) {
              toast.error(message(error, 'Could not delete the field'));
            }
          }
          setDeleting(null);
        }}
      />
    </div>
  );
};

export const TrackerSettingsDialog = ({
  open,
  onOpenChange,
  assessmentId,
  tracker,
  customFields,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentId: string;
  tracker: Tracker;
  customFields: CustomField[];
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Customize tracker</DialogTitle>
        <DialogDescription>Changes apply immediately. Your items are never touched by display settings.</DialogDescription>
      </DialogHeader>
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="columns">Columns</TabsTrigger>
          <TabsTrigger value="fields">Custom fields</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <GeneralTab assessmentId={assessmentId} tracker={tracker} />
        </TabsContent>
        <TabsContent value="columns">
          <ColumnsTab assessmentId={assessmentId} tracker={tracker} customFields={customFields} />
        </TabsContent>
        <TabsContent value="fields">
          <CustomFieldsTab assessmentId={assessmentId} customFields={customFields} />
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
);
