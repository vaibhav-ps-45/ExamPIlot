import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api';

const passwordHints = [
  'At least 10 characters',
  'One uppercase and one lowercase letter',
  'At least one digit',
];

export const SignInPage = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await signIn(email.trim(), password);
      navigate('/', { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 401
          ? 'That email and password combination is not correct.'
          : caught instanceof Error
            ? caught.message
            : 'Could not sign in.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            EP
          </div>
          <div>
            <p className="text-base font-semibold">ExamPilot</p>
            <p className="text-xs text-muted-foreground">Plan it, track it, keep control of it</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Your assessments and trackers are private to your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              {error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              No account yet?{' '}
              <Link to="/sign-up" className="text-primary underline-offset-4 hover:underline">
                Create one
              </Link>
            </p>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Demo workspace: demo@exampilot.local / DemoPassword123!
        </p>
      </div>
    </div>
  );
};

export const SignUpPage = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Array<{ path: string; message: string }>>([]);
  const [pending, setPending] = useState(false);

  // Default the account time zone to the browser's, which is the best guess
  // available before the user tells us otherwise. It is editable in settings.
  const [timeZone, setTimeZone] = useState('UTC');
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) setTimeZone(detected);
    } catch {
      // Keep UTC when the runtime cannot report a zone.
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors([]);
    setPending(true);
    try {
      await signUp({ ...form, email: form.email.trim(), timeZone });
      navigate('/', { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors);
      } else {
        setError(caught instanceof Error ? caught.message : 'Could not create the account.');
      }
    } finally {
      setPending(false);
    }
  };

  const errorFor = (path: string) => fieldErrors.find((entry) => entry.path === path)?.message;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            EP
          </div>
          <div>
            <p className="text-base font-semibold">Create your account</p>
            <p className="text-xs text-muted-foreground">Everything you track stays yours.</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="displayName">Name</Label>
                <Input
                  id="displayName"
                  required
                  autoComplete="name"
                  value={form.displayName}
                  onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                />
                {errorFor('displayName') && <p className="text-xs text-destructive">{errorFor('displayName')}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
                {errorFor('email') && <p className="text-xs text-destructive">{errorFor('email')}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {passwordHints.map((hint) => (
                    <li key={hint}>· {hint}</li>
                  ))}
                </ul>
                {errorFor('password') && <p className="text-xs text-destructive">{errorFor('password')}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="timezone">Time zone</Label>
                <Input
                  id="timezone"
                  value={timeZone}
                  onChange={(event) => setTimeZone(event.target.value)}
                  aria-describedby="timezone-help"
                />
                <p id="timezone-help" className="text-xs text-muted-foreground">
                  Detected from your browser. Used for countdowns and reminders.
                </p>
                {errorFor('timeZone') && <p className="text-xs text-destructive">{errorFor('timeZone')}</p>}
              </div>

              {error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Creating account…' : 'Create account'}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/sign-in" className="text-primary underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
