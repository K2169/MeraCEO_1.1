import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type LanguagePreference = 'en' | 'hi';
type Preferences = { theme: ThemePreference; language: LanguagePreference };
const KEY = 'meraceo.preferences';
let snapshot: Preferences = { theme: 'system', language: 'en' };
const listeners = new Set<() => void>();
let loading: Promise<void> | undefined;
let revision = 0;
let writes = Promise.resolve();

// Restore only supported values; a delayed read must not overwrite a newer user choice.
export function initializePreferences(): Promise<void> {
  if (loading) return loading;
  const startedAt = revision;
  loading = AsyncStorage.getItem(KEY).then((raw) => {
    if (!raw || revision !== startedAt) return;
    const saved = JSON.parse(raw) as Partial<Preferences>;
    snapshot = {
      theme: saved.theme === 'light' || saved.theme === 'dark' ? saved.theme : 'system',
      language: saved.language === 'hi' ? 'hi' : 'en',
    };
    listeners.forEach((listener) => listener());
  }).catch(() => undefined);
  return loading;
}

// Share one stable preference snapshot between theme, translations, and settings.
export function getPreferences(): Preferences { return snapshot; }
export function subscribePreferences(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribePreferences, getPreferences, getPreferences);
}

// Persist before publishing a choice; serialize taps so older writes cannot win.
export function savePreferences(patch: Partial<Preferences>): Promise<void> {
  revision += 1;
  const operation = writes.then(async () => {
    const next = { ...snapshot, ...patch };
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    snapshot = next;
    listeners.forEach((listener) => listener());
  });
  writes = operation.catch(() => undefined);
  return operation;
}
