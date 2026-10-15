import { useEffect } from 'react';
import { toast } from 'sonner';
import { useReminders, useSettings } from '@/lib/queries';
import { pickNewDeliveries } from './notifier-logic';

const STORAGE_KEY = 'exampilot.seenDeliveries.v1';
const MAX_REMEMBERED = 300;

/** Storage can be unavailable or full; the notifier must keep working without it. */
const readSeen = (): Set<string> | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : []);
  } catch {
    return new Set();
  }
};

const writeSeen = (seen: Set<string>): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen].slice(-MAX_REMEMBERED)));
  } catch {
    /* nothing useful to do */
  }
};

/**
 * Shows in-app and browser notifications for reminders the server delivered.
 *
 * It creates nothing and changes nothing: it only displays deliveries that
 * already exist, for reminders the user created and enabled, through channels
 * the user switched on in Settings. Limits, stated plainly: it polls, so it
 * works while the app is open in a tab; browser notifications also need the
 * permission the user granted.
 */
export const ReminderNotifier = () => {
  const settings = useSettings();
  const reminders = useReminders({ pageSize: 100 }, { refetchInterval: 30_000, refetchIntervalInBackground: false });

  useEffect(() => {
    const data = reminders.data?.items;
    if (!data || !settings.data) return;

    // Re-read each time so a second tab does not repeat what the first one showed.
    const stored = readSeen();
    const firstRun = stored === null;
    const seen = stored ?? new Set<string>();
    const { fresh, unseenKeys } = pickNewDeliveries(data, seen, Date.now());

    // On a brand-new install, existing history is recorded but never replayed.
    if (!firstRun) {
      for (const { key, reminder } of fresh) {
        if (settings.data.inAppNotificationsEnabled) {
          toast(reminder.title, { description: reminder.message ?? 'Reminder', duration: 12_000, id: key });
        }
        if (
          settings.data.browserNotificationsEnabled &&
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted'
        ) {
          try {
            // `tag` makes the browser collapse the same notification across tabs.
            new Notification(reminder.title, { body: reminder.message ?? 'Reminder', tag: key });
          } catch {
            /* some browsers only allow notifications from a service worker */
          }
        }
      }
    }

    if (unseenKeys.length > 0 || firstRun) {
      for (const key of unseenKeys) seen.add(key);
      writeSeen(seen);
    }
  }, [reminders.data, settings.data]);

  return null;
};
