import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/button';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { t } from '@/i18n';

const EMPTY: readonly string[] = [];
const records = new Map<string, readonly string[]>();
const loaded = new Set<string>();
const listeners = new Set<() => void>();
const queues = new Map<string, Promise<void>>();
const key = (userId: string) => `meraceo.opportunityShortlist.${encodeURIComponent(userId)}`;
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function notify() { listeners.forEach((listener) => listener()); }

// Store only identifiers per authenticated account; API eligibility still controls visible records.
export function useOpportunityShortlist() {
  const { user } = useSession();
  const userId = user?.id;
  const ids = useSyncExternalStore(subscribe, () => userId ? records.get(userId) ?? EMPTY : EMPTY);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (!userId) return;
    setReady(false); setFailed(false);
    if (loaded.has(userId)) { setReady(true); return; }
    AsyncStorage.getItem(key(userId)).then((raw) => {
      if (!active) return;
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string')) throw new Error('Invalid shortlist');
      records.set(userId, [...new Set(parsed as string[])]); loaded.add(userId); notify(); setReady(true);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [userId, attempt]);
  async function toggle(id: string) {
    if (!userId || !ready || !loaded.has(userId)) return;
    const operation = (queues.get(userId) ?? Promise.resolve()).then(async () => {
      const current = records.get(userId) ?? EMPTY;
      const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
      await AsyncStorage.setItem(key(userId), JSON.stringify(next));
      records.set(userId, next); notify();
    });
    queues.set(userId, operation.catch(() => undefined));
    try { await operation; setFailed(false); } catch { setFailed(true); }
  }
  return { ids, isSaved: (id: string) => ids.includes(id), ready: !!userId && loaded.has(userId) && ready, failed, toggle, retry: () => { setFailed(false); setAttempt((value) => value + 1); } };
}

// Shared P5/P8 action publishes state only after the shortlist is saved successfully.
export function OpportunityShortlistButton({ id }: { id: string }) {
  const { colors, space, type } = useTheme();
  const { ids, ready, failed, toggle, retry } = useOpportunityShortlist();
  const [busy, setBusy] = useState(false);
  return <View style={{ gap: space.sm }}>
    <Button small variant="secondary" label={t(ids.includes(id) ? 'opp.removeShortlist' : 'opp.addShortlist')} disabled={!ready || busy} onPress={async () => { setBusy(true); try { await toggle(id); } finally { setBusy(false); } }} />
    {failed ? <><Text accessibilityRole="alert" style={[type.caption, { color: colors.danger }]}>{t('common.genericError')}</Text>{!ready ? <Button small label={t('common.retry')} onPress={retry} /> : null}</> : null}
  </View>;
}
