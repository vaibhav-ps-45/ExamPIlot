import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setAccessToken, setSessionExpiredHandler } from '@/lib/api';
import { keys } from '@/lib/queries';
import type { User } from '@/lib/types';

/**
 * Authentication state.
 *
 * The access token is held in memory only (inside the api module), so a page
 * reload starts with no token and the app attempts a silent refresh using the
 * httpOnly cookie. That is why `status` starts as 'loading' rather than
 * 'unauthenticated' — otherwise a signed-in user would flash the sign-in screen
 * on every refresh.
 */
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { email: string; password: string; displayName: string; timeZone: string }) => Promise<void>;
  signOut: () => Promise<void>;
  signOutEverywhere: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('unauthenticated');
    // Drop any cached data belonging to the previous account.
    queryClient.clear();
  }, [queryClient]);

  // A failed refresh anywhere in the app routes back to sign-in.
  useEffect(() => {
    setSessionExpiredHandler(clearSession);
    return () => setSessionExpiredHandler(null);
  }, [clearSession]);

  // Attempt one silent refresh on mount.
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const refreshed = await api.post<{ user: User; accessToken: string }>(
          '/api/auth/refresh',
          undefined,
          { skipAuthRetry: true },
        );
        if (cancelled) return;
        setAccessToken(refreshed.accessToken);
        setUser(refreshed.user);
        setStatus('authenticated');
      } catch {
        if (cancelled) return;
        clearSession();
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await api.post<{ user: User; accessToken: string }>('/api/auth/login', {
        email,
        password,
      });
      setAccessToken(result.accessToken);
      setUser(result.user);
      setStatus('authenticated');
      queryClient.clear();
    },
    [queryClient],
  );

  const signUp = useCallback(
    async (input: { email: string; password: string; displayName: string; timeZone: string }) => {
      const result = await api.post<{ user: User; accessToken: string }>('/api/auth/register', input);
      setAccessToken(result.accessToken);
      setUser(result.user);
      setStatus('authenticated');
      queryClient.clear();
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // A failed logout must still clear local state.
    }
    clearSession();
  }, [clearSession]);

  const signOutEverywhere = useCallback(async () => {
    try {
      await api.post('/api/auth/logout-all');
    } catch {
      // Ignore: the local session is cleared regardless.
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ status, user, signIn, signUp, signOut, signOutEverywhere }),
    [status, user, signIn, signUp, signOut, signOutEverywhere],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
};

/** Re-exported so components do not need to import from the api module directly. */
export { keys };
