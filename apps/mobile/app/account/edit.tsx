import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';

import { Button } from '@/components/button';
import { t } from '@/i18n';
import { Screen } from '@/components/screen';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { OwnerOnboardingFlow } from '@/features/onboarding-owner/owner-onboarding';
import { ProfessionalOnboardingFlow } from '@/features/onboarding-pro/professional-onboarding';
import { api } from '@/lib/api';

// Edit profile: the same steps as onboarding, filled in with the saved answers. Saving goes back.
export default function EditProfile() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const { token, user } = useSession();
  const [initial, setInitial] = useState<Record<string, unknown> | null>(null);

  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    if (!token) return;
    setFailed(false);
    try { setInitial((await api.getProfile(token)).data); }
    catch { setFailed(true); }
  }, [token]);

  // Load the saved answers to start from.
  useEffect(() => {
    void load();
  }, [load]);

  if (!initial) {
    return (
      <Screen>
        {failed ? <>
          <Text style={[type.body, { color: colors.text }]}>{t('common.genericError')}</Text>
          <Button label={t('common.retry')} onPress={() => void load()} />
        </> : <ActivityIndicator color={colors.primary} />}
      </Screen>
    );
  }
  return user?.role === 'owner' ? (
    <OwnerOnboardingFlow initial={initial} onComplete={() => router.back()} />
  ) : (
    <ProfessionalOnboardingFlow initial={initial} onComplete={() => router.back()} />
  );
}
