import AsyncStorage from '@react-native-async-storage/async-storage';

// Local-only progress until the server saves onboarding (W3-05). Survives an app kill (W3-01 AC).
const ROLE_INTENT = 'meraceo.intendedRole';
const DRAFT = (role: string) => `meraceo.draft.${role}`;
const DONE = (role: string) => `meraceo.onboardingDone.${role}`;
const CONSENT_DONE = 'meraceo.consentDone';

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
  getDraft: <T>(role: string) => read<T>(DRAFT(role)),
  setDraft: (role: string, draft: unknown) => write(DRAFT(role), draft),
  clearDraft: (role: string) => AsyncStorage.removeItem(DRAFT(role)),
  isOnboardingDone: (role: string) => read<boolean>(DONE(role)).then((v) => v === true),
  markOnboardingDone: (role: string) => write(DONE(role), true),
  isConsentDone: () => read<boolean>(CONSENT_DONE).then((v) => v === true),
  markConsentDone: () => write(CONSENT_DONE, true),
  clearAll: async () => {
    await Promise.all(
      [ROLE_INTENT, CONSENT_DONE, DRAFT('owner'), DRAFT('professional'), DONE('owner'), DONE('professional')].map((key) =>
        AsyncStorage.removeItem(key),
      ),
    );
  },
};
