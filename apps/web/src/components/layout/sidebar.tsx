import {
  Bookmark,
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  Moon,
  NotebookPen,
  Settings,
  Sun,
  Target,
  Timer,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useReminders } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { useActiveAssessment } from './app-shell';
import { AssessmentSwitcher } from './assessment-switcher';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Shown as a count badge, e.g. reminders needing attention. */
  badge?: number;
}

export const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { assessmentId } = useActiveAssessment();
  const { user } = useAuth();
  const { resolved, setTheme } = useTheme();

  // Count only reminders that need the user's attention: pending and not yet
  // dismissed. A missed reminder is surfaced, never silently rescheduled.
  const remindersQuery = useReminders({ pageSize: 100 }, { enabled: Boolean(assessmentId) });
  const attentionCount =
    remindersQuery.data?.items.filter((reminder) => reminder.enabled && reminder.isMissed).length ?? 0;

  const scoped: NavItem[] = assessmentId
    ? [
        { to: `/assessments/${assessmentId}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
        { to: `/assessments/${assessmentId}/trackers`, label: 'Trackers', icon: ListChecks },
        { to: `/assessments/${assessmentId}/syllabus`, label: 'Syllabus', icon: Target },
        { to: `/assessments/${assessmentId}/schedule`, label: 'Schedule', icon: CalendarDays },
        { to: `/assessments/${assessmentId}/sessions`, label: 'Study sessions', icon: Timer },
        { to: `/assessments/${assessmentId}/mock-tests`, label: 'Mock tests', icon: Target },
        { to: `/assessments/${assessmentId}/notes`, label: 'Notes', icon: NotebookPen },
      ]
    : [];

  const global: NavItem[] = [
    { to: '/assessments', label: 'Assessments', icon: LayoutDashboard },
    { to: '/saved', label: 'Saved for later', icon: Bookmark },
    { to: '/reminders', label: 'Reminders', icon: CalendarDays, badge: attentionCount },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
            isActive
              ? 'bg-accent font-medium text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
          )
        }
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{item.label}</span>
        {item.badge !== undefined && item.badge > 0 && (
          <span
            className="ml-auto rounded-full bg-destructive/15 px-1.5 py-0.5 text-xs font-medium text-destructive"
            aria-label={`${item.badge} need attention`}
          >
            {item.badge}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <TooltipProvider delayDuration={300}>
      <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-card lg:w-64">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            EP
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">ExamPilot</p>
            <p className="truncate text-xs text-muted-foreground">Study planner</p>
          </div>
        </div>

        <div className="px-3 pb-3">
          <AssessmentSwitcher onNavigate={onNavigate} />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4 scrollbar-thin" aria-label="Main">
          {scoped.length > 0 && (
            <>
              <p className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Workspace
              </p>
              {scoped.map(renderItem)}
              <Separator className="my-3" />
            </>
          )}
          <p className="px-2.5 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Account
          </p>
          {global.map(renderItem)}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.displayName ?? 'Signed in'}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setTheme(resolved === 'dark' ? 'LIGHT' : 'DARK')}
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label={resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                >
                  {resolved === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>{resolved === 'dark' ? 'Light theme' : 'Dark theme'}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
};
