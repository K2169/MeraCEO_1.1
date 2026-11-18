import AsyncStorage from '@react-native-async-storage/async-storage';

// Local-only progress until the server saves onboarding (W3-05). Survives an app kill (W3-01 AC).
const ROLE_INTENT = 'meraceo.intendedRole';
const DRAFT = (role: string) => `meraceo.draft.${role}`;
const LEGACY_PRO_DRAFT = DRAFT('professional');
const PRO_DRAFT_PREFIX = `${LEGACY_PRO_DRAFT}.`;
const DONE = (role: string) => `meraceo.onboardingDone.${role}`;
const CONSENT_DONE = 'meraceo.consentDone';
const draftKey = (role: string, userId?: string) =>
  userId ? `${DRAFT(role)}.${encodeURIComponent(userId)}` : DRAFT(role);

// Reads one saved value from the phone and turns it back into an object.
async function read<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  return raw === null ? null : (JSON.parse(raw) as T);
}

// Saves one value on the phone as text.
async function write(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// All the on-device progress flags in one place: role choice, drafts, onboarding done, consent done.
export const progress = {
  getIntendedRole: () => read<'owner' | 'professional'>(ROLE_INTENT),
  setIntendedRole: (role: 'owner' | 'professional') => write(ROLE_INTENT, role),
  getDraft: async <T>(role: string, userId?: string): Promise<T | null> => {
    if (!userId) {
      // An unowned legacy draft must never be restored into an authenticated account.
      await AsyncStorage.removeItem(LEGACY_PRO_DRAFT);
      return null;
    }
    const saved = await read<T>(draftKey(role, userId));
    await AsyncStorage.removeItem(DRAFT(role));
    return saved;
  },
  setDraft: async (role: string, draft: unknown, userId?: string): Promise<void> => {
    if (!userId) throw new Error('A user ID is required for professional onboarding drafts');
    await write(draftKey(role, userId), draft);
    await AsyncStorage.removeItem(DRAFT(role));
  },
  clearDraft: async (role: string, userId?: string): Promise<void> => {
    await AsyncStorage.removeItem(draftKey(role, userId));
    await AsyncStorage.removeItem(DRAFT(role));
  },
  isOnboardingDone: (role: string) => read<boolean>(DONE(role)).then((v) => v === true),
  markOnboardingDone: (role: string) => write(DONE(role), true),
  isConsentDone: () => read<boolean>(CONSENT_DONE).then((v) => v === true),
  markConsentDone: () => write(CONSENT_DONE, true),
  clearAll: async () => {
    const professionalDrafts = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(PRO_DRAFT_PREFIX) || key.startsWith(`${DRAFT('owner')}.`));
    await Promise.all(
      [ROLE_INTENT, CONSENT_DONE, DRAFT('owner'), LEGACY_PRO_DRAFT, ...professionalDrafts, DONE('owner'), DONE('professional')].map((key) =>
        AsyncStorage.removeItem(key),
      ),
    );
  },
};
