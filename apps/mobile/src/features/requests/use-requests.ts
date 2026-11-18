import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useSession } from '@/features/auth/session-provider';
import { api, type RequestItem } from '@/lib/api';

// Loads the signed-in person's requests whenever the screen comes into view, and runs accept,
// decline or cancel on one of them. `error` is true when the last action failed.
export function useRequests() {
  const { token } = useSession();
  const [requests, setRequests] = useState<RequestItem[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);

  // Keep failed fetches distinct from a successful empty response.
  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(false);
    try { setRequests((await api.getRequests(token)).requests); }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [token]);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  // Send the action, then swap the updated request into the list.
  async function act(id: string, action: 'accept' | 'decline' | 'cancel' | 'complete') {
    if (!token) return;
    setBusyId(id);
    setError(false);
    try {
      const updated = await api.actOnRequest(token, id, action);
      setRequests((list) => (list ?? []).map((r) => (r.id === id ? updated : r)));
    } catch {
      setError(true);
    } finally {
      setBusyId(null);
    }
  }

  // Set the planned start time of an accepted consultation. Returns true when it worked.
  async function schedule(id: string, startsAt: string, proposalId?: string): Promise<boolean> {
    if (!token) return false;
    setBusyId(id);
    setError(false);
    try {
      const updated = await api.scheduleConsultation(token, id, startsAt, proposalId);
      setRequests((list) => (list ?? []).map((r) => (r.id === id ? updated : r)));
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setBusyId(null);
    }
  }

  return { requests, busyId, error, loadError, loading, reload, act, schedule };
}
