import { Bell, LogOut, Settings as SettingsIcon, User } from 'lucide-react';
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
import { useAuth } from '@/hooks/use-auth';
import { formatDateTime, formatDaysRemaining, initials } from '@/lib/format';
import { useReminders } from '@/lib/queries';
import { useActiveAssessment } from './app-shell';

/**
 * Page header. The assessment countdown lives here so it is visible from every
 * workspace page, and it is always labelled with the assessment's time zone —
 * a countdown that silently used the browser's zone would be wrong for a user
 * studying for an exam in another country.
 */
export const Topbar = () => {
  const { assessment, assessmentId } = useActiveAssessment();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const remindersQuery = useReminders({ pageSize: 100 }, { enabled: Boolean(assessmentId) });
  const missed = remindersQuery.data?.items.filter((reminder) => reminder.enabled && reminder.isMissed) ?? [];
  const nextReminder = remindersQuery.data?.items
    .filter((reminder) => reminder.enabled && reminder.status !== 'DISMISSED' && !reminder.isMissed)
    .sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime())[0];

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/sign-in', { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-2.5 sm:px-6 lg:px-8">
      <div className="min-w-0">
        {assessment ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h1 className="truncate text-sm font-semibold">{assessment.name}</h1>
            <p className="text-xs text-muted-foreground">
              {assessment.examDate
                ? `${formatDaysRemaining(assessment.daysUntilExam)} · exam ${assessment.examDate.slice(0, 10)} (${assessment.timeZone})`
                : `No exam date · ${assessment.timeZone}`}
            </p>
          </div>
        ) : (
          <h1 className="text-sm font-semibold">ExamPilot</h1>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" asChild>
          <Link
            to="/reminders"
            aria-label={
              missed.length > 0
                ? `Reminders — ${missed.length} need attention`
                : 'Reminders'
            }
            className="relative"
          >
            <Bell className="size-4" />
            {missed.length > 0 && (
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive" />
            )}
          </Link>
        </Button>

        {nextReminder && (
          <span className="hidden text-xs text-muted-foreground md:inline">
            Next: {nextReminder.title} · {formatDateTime(nextReminder.remindAt, nextReminder.timeZone)}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Account menu">
              <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                {initials(user?.displayName ?? 'U')}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <span className="block truncate">{user?.displayName}</span>
              <span className="block truncate font-normal normal-case">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer">
                <User className="size-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer">
                <SettingsIcon className="size-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void handleSignOut()}
              disabled={signingOut}
              className="cursor-pointer"
            >
              <LogOut className="size-4" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
