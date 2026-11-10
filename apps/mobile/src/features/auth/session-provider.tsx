import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, ApiError, type Me } from '@/lib/api';

import { clearSessionToken, loadSessionToken, saveSessionToken } from './session-store';

interface SessionValue {
  loading: boolean;
  token: string | null;
  user: Me | null;
  // Stores a new session after Google sign-in and loads the user.
  startSession: (token: string) => Promise<void>;
  // Reloads the user from the API (after age, role or consent changes).
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

// Holds the signed-in user and token for the whole app. Loads the saved session on start.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<Me | null>(null);

  const loadUser = useCallback(async (sessionToken: string) => {
    try {
      const me = await api.getMe(sessionToken);
      setToken(sessionToken);
      setUser(me);
    } catch (err) {
      // A rejected or expired token means the person must sign in again.
      if (err instanceof ApiError && err.status === 401) {
        await clearSessionToken();
      }
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadSessionToken();
      if (saved) await loadUser(saved);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadUser]);

  const startSession = useCallback(
    async (sessionToken: string) => {
      await saveSessionToken(sessionToken);
      await loadUser(sessionToken);
    },
    [loadUser],
  );

  const refresh = useCallback(async () => {
    if (token) await loadUser(token);
  }, [token, loadUser]);

  const signOut = useCallback(async () => {
    await clearSessionToken();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ loading, token, user, startSession, refresh, signOut }),
    [loading, token, user, startSession, refresh, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// Lets any screen read the current session (user, token, sign in, sign out).
export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
