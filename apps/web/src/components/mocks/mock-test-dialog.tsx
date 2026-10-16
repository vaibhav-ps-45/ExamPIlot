import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fromZonedInputValue, toDateInputValue } from '@/lib/format';
import { useMockTestMutations } from '@/lib/queries';
import type { MockTest } from '@/lib/types';

interface SectionDraft {
  name: string;
  totalMarks: string;
  marksObtained: string;
}

interface Draft {
  name: string;
  takenOn: string;
  totalMarks: string;
  marksObtained: string;
  durationMinutes: string;
  notes: string;
  reviewed: boolean;
  sections: SectionDraft[];
}

const blank = (today: string): Draft => ({
  name: '',
  takenOn: today,
  totalMarks: '',
  marksObtained: '',
  durationMinutes: '',
  notes: '',
  reviewed: false,
  sections: [],
});

const isNumber = (value: string) => /^\d+(\.\d+)?$/.test(value.trim());

/** Returns a message per field that is wrong. Empty object means the form is valid. */
export const validateMock = (draft: Draft): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!draft.name.trim()) errors.name = 'Give the test a name.';
  if (!draft.takenOn) errors.takenOn = 'Pick the date you took it.';
  if (!isNumber(draft.totalMarks)) errors.totalMarks = 'Enter the total marks.';
  if (!isNumber(draft.marksObtained)) errors.marksObtained = 'Enter the marks you got.';
  if (!errors.totalMarks && !errors.marksObtained && Number(draft.marksObtained) > Number(draft.totalMarks)) {
    errors.marksObtained = 'Marks obtained cannot be more than the total.';
  }
  if (draft.durationMinutes && !/^\d+$/.test(draft.durationMinutes)) errors.durationMinutes = 'Whole minutes only.';
  draft.sections.forEach((section, index) => {
    if (!section.name.trim()) errors[`section-${index}`] = 'Name the section.';
    else if (!isNumber(section.totalMarks) || !isNumber(section.marksObtained)) errors[`section-${index}`] = 'Enter both marks.';
    else if (Number(section.marksObtained) > Number(section.totalMarks)) errors[`section-${index}`] = 'More than the section total.';
  });
  return errors;
};

/** Manual entry of a result. This app records scores; it does not run the exam itself. */
export const MockTestDialog = ({
  open,
  onOpenChange,
  assessmentId,
  timeZone,
  test,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentId: string;
  timeZone: string;
  test: MockTest | null;
}) => {
  const { create, update } = useMockTestMutations(assessmentId);
  const today = toDateInputValue(new Date().toISOString(), timeZone);
  const [draft, setDraft] = useState<Draft>(blank(today));
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowErrors(false);
    if (test) {
      setDraft({
        name: test.name,
        takenOn: toDateInputValue(test.takenOn, timeZone),
        totalMarks: String(test.totalMarks),
        marksObtained: String(test.marksObtained),
        durationMinutes: test.durationMinutes === null ? '' : String(test.durationMinutes),
        notes: test.notes ?? '',
        reviewed: test.reviewed,
        sections: (test.sections ?? []).map((section) => ({
          name: section.name,
          totalMarks: String(section.totalMarks),
          marksObtained: String(section.marksObtained),
        })),
      });
    } else {
      setDraft(blank(toDateInputValue(new Date().toISOString(), timeZone)));
    }
  }, [open, test, timeZone]);

  const errors = useMemo(() => validateMock(draft), [draft]);
  const sectionTotal = draft.sections.reduce((sum, section) => sum + (isNumber(section.totalMarks) ? Number(section.totalMarks) : 0), 0);
  const sectionScore = draft.sections.reduce((sum, section) => sum + (isNumber(section.marksObtained) ? Number(section.marksObtained) : 0), 0);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const setSection = (index: number, patch: Partial<SectionDraft>) =>
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section, i) => (i === index ? { ...section, ...patch } : section)),
    }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;
    const payload = {
      name: draft.name.trim(),
      takenOn: fromZonedInputValue(draft.takenOn, timeZone),
      totalMarks: Number(draft.totalMarks),
      marksObtained: Number(draft.marksObtained),
      durationMinutes: draft.durationMinutes ? Number(draft.durationMinutes) : null,
      sections: draft.sections.length
        ? draft.sections.map((section) => ({
            name: section.name.trim(),
            totalMarks: Number(section.totalMarks),
            marksObtained: Number(section.marksObtained),
          }))
        : null,
      notes: draft.notes.trim() || null,
      reviewed: draft.reviewed,
    };
    try {
      if (test) await update.mutateAsync({ id: test.id, ...payload });
      else await create.mutateAsync(payload);
      toast.success(test ? 'Result updated' : 'Result recorded');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the result');
    }
  };

  const err = (key: string) =>
    showErrors && errors[key] ? (
      <p role="alert" className="mt-1 text-xs text-destructive">
        {errors[key]}
      </p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{test ? 'Edit result' : 'Record a mock test'}</DialogTitle>
          <DialogDescription>Enter the result you got. Averages and trends are worked out from what you record here.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="mt-name">Test name</Label>
              <Input id="mt-name" autoFocus value={draft.name} maxLength={200} onChange={(event) => set('name', event.target.value)} />
              {err('name')}
            </div>
            <div>
              <Label htmlFor="mt-date">Date taken</Label>
              <Input id="mt-date" type="date" value={draft.takenOn} onChange={(event) => set('takenOn', event.target.value)} />
              {err('takenOn')}
            </div>
            <div>
              <Label htmlFor="mt-total">Total marks</Label>
              <Input id="mt-total" inputMode="decimal" value={draft.totalMarks} onChange={(event) => set('totalMarks', event.target.value)} />
              {err('totalMarks')}
            </div>
            <div>
              <Label htmlFor="mt-got">Marks obtained</Label>
              <Input id="mt-got" inputMode="decimal" value={draft.marksObtained} onChange={(event) => set('marksObtained', event.target.value)} />
              {err('marksObtained')}
            </div>
            <div>
              <Label htmlFor="mt-dur">Duration in minutes (optional)</Label>
              <Input id="mt-dur" inputMode="numeric" value={draft.durationMinutes} onChange={(event) => set('durationMinutes', event.target.value)} />
              {err('durationMinutes')}
            </div>
          </div>

          <fieldset className="space-y-2 rounded-md border border-border p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">Section-wise scores (optional)</legend>
            {draft.sections.map((section, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Input aria-label={`Section ${index + 1} name`} placeholder="Section" value={section.name} onChange={(event) => setSection(index, { name: event.target.value })} />
                  <Input className="w-24" aria-label={`Section ${index + 1} marks obtained`} placeholder="Got" inputMode="decimal" value={section.marksObtained} onChange={(event) => setSection(index, { marksObtained: event.target.value })} />
                  <span aria-hidden="true">/</span>
                  <Input className="w-24" aria-label={`Section ${index + 1} total marks`} placeholder="Out of" inputMode="decimal" value={section.totalMarks} onChange={(event) => setSection(index, { totalMarks: event.target.value })} />
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove section ${index + 1}`} onClick={() => set('sections', draft.sections.filter((_, i) => i !== index))}>
                    <Trash2 />
                  </Button>
                </div>
                {err(`section-${index}`)}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" size="sm" disabled={draft.sections.length >= 30} onClick={() => set('sections', [...draft.sections, { name: '', totalMarks: '', marksObtained: '' }])}>
                <Plus /> Add section
              </Button>
              {draft.sections.length > 0 && isNumber(draft.totalMarks) && sectionTotal !== Number(draft.totalMarks) && (
                <p className="text-xs text-muted-foreground">{`Sections add up to ${sectionScore} of ${sectionTotal} marks, and the test total is ${draft.totalMarks}.`}</p>
              )}
            </div>
          </fieldset>

          <div>
            <Label htmlFor="mt-notes">Notes (optional)</Label>
            <Textarea id="mt-notes" rows={3} value={draft.notes} maxLength={4000} onChange={(event) => set('notes', event.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={draft.reviewed} onCheckedChange={(checked) => set('reviewed', checked === true)} />
            I have reviewed my mistakes for this test
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {test ? 'Save changes' : 'Record result'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
