import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { LoadingState } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
const SignInPage = lazy(() => import('@/pages/auth-pages').then((module) => ({ default: module.SignInPage })));
const SignUpPage = lazy(() => import('@/pages/auth-pages').then((module) => ({ default: module.SignUpPage })));
const AssessmentsPage = lazy(() => import('@/pages/assessments-page').then((module) => ({ default: module.AssessmentsPage })));
const AssessmentDetailRedirect = lazy(() => import('@/pages/assessments-page').then((module) => ({ default: module.AssessmentDetailRedirect })));
const DashboardPage = lazy(() => import('@/pages/dashboard-page').then((module) => ({ default: module.DashboardPage })));
const TrackersPage = lazy(() => import('@/pages/trackers-page').then((module) => ({ default: module.TrackersPage })));
const SyllabusPage = lazy(() => import('@/pages/syllabus-page').then((module) => ({ default: module.SyllabusPage })));
const SchedulePage = lazy(() => import('@/pages/schedule-page').then((module) => ({ default: module.SchedulePage })));
const SessionsPage = lazy(() => import('@/pages/sessions-page').then((module) => ({ default: module.SessionsPage })));
const MockTestsPage = lazy(() => import('@/pages/mock-tests-page').then((module) => ({ default: module.MockTestsPage })));
const NotesPage = lazy(() => import('@/pages/notes-page').then((module) => ({ default: module.NotesPage })));
const SavedPage = lazy(() => import('@/pages/saved-page').then((module) => ({ default: module.SavedPage })));
const RemindersPage = lazy(() => import('@/pages/reminders-page').then((module) => ({ default: module.RemindersPage })));
const SettingsPage = lazy(() => import('@/pages/settings-page').then((module) => ({ default: module.SettingsPage })));
const NotFoundPage = lazy(() => import('@/pages/not-found-page').then((module) => ({ default: module.NotFoundPage })));

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

export const AppRoutes = () => (
  <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><LoadingState label="Loading page…" /></div>}>
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
  </Suspense>
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
