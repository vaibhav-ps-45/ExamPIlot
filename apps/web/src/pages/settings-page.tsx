import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Laptop, LogOut, Monitor, Moon, Smartphone, Sun } from 'lucide-react';
import { THEME_PREFERENCES, type ThemePreference } from '@exampilot/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorState, ListSkeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime } from '@/lib/format';
import { timeZoneOptions } from '@/lib/timezones';
import { useAccountSessions, useRevokeSession, useSettings, useUpdateProfile, useUpdateSettings } from '@/lib/queries';
import { cn } from '@/lib/utils';

const THEME_META: Record<ThemePreference, { label: string; icon: typeof Sun }> = {
  SYSTEM: { label: 'Match my device', icon: Monitor },
  LIGHT: { label: 'Light', icon: Sun },
  DARK: { label: 'Dark', icon: Moon },
};

const message = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

/** A short, readable device name from a user-agent string. Never shown as raw text. */
export const describeDevice = (userAgent: string | null): { label: string; mobile: boolean } => {
  if (!userAgent) return { label: 'Unknown device', mobile: false };
  const mobile = /Android|iPhone|iPad|Mobile/i.test(userAgent);
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Firefox\//.test(userAgent)
          ? 'Firefox'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'Browser';
  const system = /Windows/.test(userAgent)
    ? 'Windows'
    : /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : '';
  return { label: system ? `${browser} on ${system}` : browser, mobile };
};

const ProfileCard = () => {
  const { user } = useAuth();
  const update = useUpdateProfile();
  const [name, setName] = useState(user?.displayName ?? '');
  const [zone, setZone] = useState(user?.timeZone ?? 'UTC');
  const zones = useMemo(() => timeZoneOptions(zone), [zone]);
  if (!user) return null;
  const changed = name.trim() !== user.displayName || zone !== user.timeZone;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profile</CardTitle>
        <CardDescription>{user.email}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!name.trim() || !changed) return;
            try {
              await update.mutateAsync({
                ...(name.trim() !== user.displayName ? { displayName: name.trim() } : {}),
                ...(zone !== user.timeZone ? { timeZone: zone } : {}),
              });
              toast.success('Profile updated');
            } catch (error) {
              toast.error(message(error, 'Could not update your profile'));
            }
          }}
        >
          <div>
            <Label htmlFor="pf-name">Display name</Label>
            <Input id="pf-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="pf-zone">Your time zone</Label>
            <NativeSelect id="pf-zone" value={zone} onChange={(event) => setZone(event.target.value)}>
              {zones.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={!name.trim() || !changed || update.isPending}>
              Save profile
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const AppearanceCard = () => {
  const { theme, setTheme } = useTheme();
  const settings = useSettings();
  const update = useUpdateSettings();

  const choose = async (next: ThemePreference) => {
    setTheme(next); // applies instantly and is remembered on this device
    try {
      await update.mutateAsync({ theme: next });
    } catch (error) {
      toast.error(message(error, 'Could not save your theme'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Appearance</CardTitle>
        <CardDescription>Light and dark themes both keep text readable.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div role="radiogroup" aria-label="Theme" className="grid gap-2 sm:grid-cols-3">
          {THEME_PREFERENCES.map((option) => {
            const Icon = THEME_META[option].icon;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={theme === option}
                onClick={() => void choose(option)}
                className={cn(
                  'flex items-center gap-2 rounded-md border p-3 text-sm hover:bg-accent/50',
                  theme === option ? 'border-primary bg-primary/5 font-medium' : 'border-border',
                )}
              >
                <Icon className="size-4" /> {THEME_META[option].label}
              </button>
            );
          })}
        </div>
        {settings.data && (
          <div className="max-w-sm">
            <Label htmlFor="st-zone">Default time zone for new assessments</Label>
            <NativeSelect
              id="st-zone"
              value={settings.data.defaultTimeZone}
              onChange={(event) =>
                update.mutate(
                  { defaultTimeZone: event.target.value },
                  { onError: (error) => toast.error(message(error, 'Could not save')) },
                )
              }
            >
              {timeZoneOptions(settings.data.defaultTimeZone).map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const SecurityCard = () => {
  const { signOut, signOutEverywhere } = useAuth();
  const sessions = useAccountSessions();
  const revoke = useRevokeSession();
  const [confirmAll, setConfirmAll] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Where you are signed in</CardTitle>
        <CardDescription>If you do not recognise a device, sign it out.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sessions.isLoading ? (
          <ListSkeleton rows={2} />
        ) : sessions.error ? (
          <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {(sessions.data ?? []).map((session) => {
              const device = describeDevice(session.userAgent);
              const Icon = device.mobile ? Smartphone : Laptop;
              return (
                <li key={session.id} className="flex items-center gap-3 p-3">
                  <Icon className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {device.label}
                      {session.isCurrent && <Badge variant="outline">This device</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {`Signed in ${formatDateTime(session.createdAt, Intl.DateTimeFormat().resolvedOptions().timeZone)}`}
                      {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                    </p>
                  </div>
                  {!session.isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={revoke.isPending}
                      onClick={() =>
                        revoke.mutate(session.id, {
                          onSuccess: () => toast.success('Signed out of that device'),
                          onError: (error) => toast.error(message(error, 'Could not sign it out')),
                        })
                      }
                    >
                      Sign out
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOut /> Sign out of this device
          </Button>
          <Button variant="outline" onClick={() => setConfirmAll(true)}>
            Sign out everywhere
          </Button>
        </div>
      </CardContent>
      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Sign out of every device?"
        description="You will be signed out here too and will need to sign in again."
        confirmLabel="Sign out everywhere"
        onConfirm={async () => {
          setConfirmAll(false);
          await signOutEverywhere();
        }}
      />
    </Card>
  );
};

export const SettingsPage = () => (
  <div className="space-y-5">
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-sm text-muted-foreground">Your account and how the app looks.</p>
    </header>
    <ProfileCard />
    <AppearanceCard />
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notifications</CardTitle>
        <CardDescription>
          Whether you are notified in the app or in your browser is set on the{' '}
          <Link to="/reminders" className="font-medium text-primary underline-offset-4 hover:underline">
            Reminders page
          </Link>
          , next to your reminders. Nothing is sent unless you create a reminder.
        </CardDescription>
      </CardHeader>
    </Card>
    <SecurityCard />
  </div>
);
