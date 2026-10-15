import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Menu, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAssessment, useAssessments } from '@/lib/queries';
import { useAuth } from '@/hooks/use-auth';
import { useIsDesktop } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import type { Assessment } from '@/lib/types';
import { ReminderNotifier } from '@/components/reminders/notifier';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

/**
 * The active assessment is app-wide state: the sidebar, the page header and
 * every data request need to agree on which workspace is open. It is derived
 * from the URL (/assessments/:assessmentId/...) rather than stored separately,
 * so a deep link, a refresh and the back button all land on the same view.
 */
interface AssessmentContextValue {
  assessmentId: string | null;
  assessment: Assessment | null;
  assessments: Assessment[];
  isLoading: boolean;
  error: unknown;
}

const AssessmentContext = createContext<AssessmentContextValue>({
  assessmentId: null,
  assessment: null,
  assessments: [],
  isLoading: false,
  error: null,
});

export const useActiveAssessment = (): AssessmentContextValue => useContext(AssessmentContext);

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const isDesktop = useIsDesktop();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  const assessmentsQuery = useAssessments({ includeArchived: 'false' });
  const assessmentQuery = useAssessment(assessmentId);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const value = useMemo<AssessmentContextValue>(
    () => ({
      assessmentId: assessmentId ?? null,
      assessment: assessmentQuery.data ?? null,
      assessments: assessmentsQuery.data ?? [],
      isLoading: assessmentsQuery.isLoading || (Boolean(assessmentId) && assessmentQuery.isLoading),
      error: assessmentsQuery.error ?? assessmentQuery.error ?? null,
    }),
    [
      assessmentId,
      assessmentQuery.data,
      assessmentQuery.isLoading,
      assessmentQuery.error,
      assessmentsQuery.data,
      assessmentsQuery.isLoading,
      assessmentsQuery.error,
    ],
  );

  return (
    <AssessmentContext.Provider value={value}>
      <ReminderNotifier />
      <div className="flex min-h-screen bg-background">
        {/* Skip link: the first tab stop, so keyboard users can bypass navigation. */}
        <a
          href="#main-content"
          className="sr-only-focusable absolute left-4 top-4 z-50 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
        >
          Skip to content
        </a>

        {isDesktop ? (
          <Sidebar />
        ) : (
          <>
            {mobileNavOpen && (
              <div
                className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
                onClick={() => setMobileNavOpen(false)}
                aria-hidden="true"
              />
            )}
            <div
              className={cn(
                'fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-card transition-transform lg:hidden',
                mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
              )}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
            >
              <Sidebar onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {!isDesktop && (
            <div className="flex items-center gap-2 border-b border-border px-4 py-2 lg:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
                aria-expanded={mobileNavOpen}
              >
                <Menu className="size-5" />
              </Button>
              <span className="text-sm font-semibold">ExamPilot</span>
            </div>
          )}

          <Topbar />

          <main id="main-content" className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </AssessmentContext.Provider>
  );
};

/**
 * Wrapper for pages that need an assessment in scope. It renders the loading and
 * error states once, so no page has to handle them itself.
 */
export const AssessmentGate = ({
  children,
  title,
}: {
  children: (assessment: Assessment) => ReactNode;
  title?: string;
}) => {
  const { assessment, assessmentId, isLoading, error } = useActiveAssessment();
  const navigate = useNavigate();

  if (isLoading && !assessment) return <LoadingState label="Loading workspace…" />;

  if (error) {
    return (
      <ErrorState
        title="Could not open this assessment"
        error={error}
        onRetry={() => navigate(0)}
      />
    );
  }

  if (!assessmentId) {
    return (
      <EmptyState
        title="No assessment selected"
        description="Pick a workspace from the sidebar, or create one to start planning."
        action={
          <Button asChild>
            <Link to="/assessments">
              <Plus className="size-4" />
              Go to assessments
            </Link>
          </Button>
        }
      />
    );
  }

  if (!assessment) {
    return (
      <ErrorState
        title={title ? `Could not load ${title}` : 'Assessment not found'}
        error={new Error('This assessment does not exist, or it belongs to another account.')}
      />
    );
  }

  return <>{children(assessment)}</>;
};

/** Small helper for pages that read query-string state (filters, selected item). */
export const useQueryState = (key: string, initial = '') => {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? initial;

  const setValue = (next: string) => {
    const updated = new URLSearchParams(params);
    if (next) updated.set(key, next);
    else updated.delete(key);
    setParams(updated, { replace: true });
  };

  return [value, setValue] as const;
};
