import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { LoadingState } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { SignInPage, SignUpPage } from '@/pages/auth-pages';

/**
 * Route table.
 *
 * Everything below /assessments/:assessmentId/ is workspace-scoped and reads its
 * assessment from the URL. Anything not authenticated is redirected to sign-in,
 * and the attempted location is remembered so the user lands back where they
 * meant to go.
 */
const RequireAuth = () => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Restoring your session…" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

/** Redirects an authenticated user away from the sign-in pages. */
const RedirectIfAuthenticated = ({ children }: { children: React.ReactNode }) => {
  const { status } = useAuth();
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <>{children}</>;
};

import {
  AssessmentsPage,
  AssessmentDetailRedirect,
} from '@/pages/assessments-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { TrackersPage } from '@/pages/trackers-page';
import { SyllabusPage } from '@/pages/syllabus-page';
import { SchedulePage } from '@/pages/schedule-page';
import { SessionsPage } from '@/pages/sessions-page';
import { MockTestsPage } from '@/pages/mock-tests-page';
import { NotesPage } from '@/pages/notes-page';
import { SavedPage } from '@/pages/saved-page';
import { RemindersPage } from '@/pages/reminders-page';
import { SettingsPage } from '@/pages/settings-page';
import { NotFoundPage } from '@/pages/not-found-page';

export const AppRoutes = () => (
  <Routes>
    <Route
      path="/sign-in"
      element={
        <RedirectIfAuthenticated>
          <SignInPage />
        </RedirectIfAuthenticated>
      }
    />
    <Route
      path="/sign-up"
      element={
        <RedirectIfAuthenticated>
          <SignUpPage />
        </RedirectIfAuthenticated>
      }
    />

    <Route element={<RequireAuth />}>
      <Route
        element={
          <AppShell>
            <Outlet />
          </AppShell>
        }
      >
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/assessments" element={<AssessmentsPage />} />
        <Route path="/assessments/:assessmentId" element={<AssessmentDetailRedirect />} />
        <Route path="/assessments/:assessmentId/dashboard" element={<DashboardPage />} />
        <Route path="/assessments/:assessmentId/trackers" element={<TrackersPage />} />
        <Route path="/assessments/:assessmentId/syllabus" element={<SyllabusPage />} />
        <Route path="/assessments/:assessmentId/schedule" element={<SchedulePage />} />
        <Route path="/assessments/:assessmentId/sessions" element={<SessionsPage />} />
        <Route path="/assessments/:assessmentId/mock-tests" element={<MockTestsPage />} />
        <Route path="/assessments/:assessmentId/notes" element={<NotesPage />} />
        <Route path="/saved" element={<SavedPage />} />
        <Route path="/reminders" element={<RemindersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Route>
  </Routes>
);

/**
 * Landing behaviour: with one active assessment, go straight to its dashboard;
 * with several, show the list so the user chooses. Sending someone into a
 * workspace they did not pick is exactly the kind of assumption this app avoids.
 */
const HomeRedirect = () => {
  const location = useLocation();
  return <Navigate to="/assessments" replace state={{ from: location.pathname }} />;
};
