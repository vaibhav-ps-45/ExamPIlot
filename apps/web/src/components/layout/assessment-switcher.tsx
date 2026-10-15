import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate, formatDaysRemaining } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useActiveAssessment } from './app-shell';

/**
 * The assessment selector. Every workspace-scoped page reads its assessment from
 * the URL, so switching here is a navigation, not a separate piece of state.
 */
export const AssessmentSwitcher = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { assessment, assessments, assessmentId } = useActiveAssessment();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-left text-sm transition-colors',
            'hover:bg-accent/60',
          )}
          aria-label="Switch assessment"
        >
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: assessment?.accentColor ?? '#94a3b8' }}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{assessment?.name ?? 'Select an assessment'}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {assessment
                ? assessment.daysUntilExam === null
                  ? 'No exam date'
                  : formatDaysRemaining(assessment.daysUntilExam)
                : `${assessments.length} available`}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Your assessments</DropdownMenuLabel>
        {assessments.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No active assessments yet. Create one to get started.
          </p>
        )}
        {assessments.map((entry) => (
          <DropdownMenuItem
            key={entry.id}
            onSelect={() => {
              navigate(`/assessments/${entry.id}/dashboard`);
              onNavigate?.();
            }}
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: entry.accentColor ?? '#94a3b8' }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{entry.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {entry.examDate ? formatDate(entry.examDate, entry.timeZone) : 'No exam date'}
              </span>
            </span>
            {entry.id === assessmentId && <Check className="size-4 shrink-0" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/assessments?new=1" onClick={onNavigate} className="cursor-pointer">
            <Plus className="size-4" />
            New assessment
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const NewAssessmentButton = () => (
  <Button asChild size="sm">
    <Link to="/assessments?new=1">
      <Plus className="size-4" />
      New assessment
    </Link>
  </Button>
);
