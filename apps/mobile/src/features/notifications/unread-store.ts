import { useEffect, useSyncExternalStore } from 'react';

import { useSession } from '@/features/auth/session-provider';
import { api } from '@/lib/api';

// The number of unread notifications, kept in one place so the tab badge and the bell always agree.
let count = 0;
const listeners = new Set<() => void>();

// Change the number and tell everything that shows it.
export function setUnread(next: number) {
  if (next === count) return;
  count = next;
  listeners.forEach((listener) => listener());
}

// Reads the current unread number. It does not fetch anything by itself.
export function useUnread(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => count,
  );
}

// Asks the server for the unread number now and every 20 seconds while this is mounted. Put it in the tab
// layout, so it runs for as long as the person is in the app. (Real push messages need a Firebase project.)
export function useUnreadPolling() {
  const { token } = useSession();
  useEffect(() => {
    if (!token) return;
    const load = () => api.getUnread(token).then((r) => setUnread(r.unread)).catch(() => undefined);
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [token]);
}
