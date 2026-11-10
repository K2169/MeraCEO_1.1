import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Screen } from '@/components/screen';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { OwnerOnboardingFlow } from '@/features/onboarding-owner/owner-onboarding';
import { ProfessionalOnboardingFlow } from '@/features/onboarding-pro/professional-onboarding';
import { api } from '@/lib/api';

// Edit profile: the same steps as onboarding, filled in with the saved answers. Saving goes back.
export default function EditProfile() {
  const { colors } = useTheme();
  const router = useRouter();
  const { token, user } = useSession();
  const [initial, setInitial] = useState<Record<string, unknown> | null>(null);

  // Load the saved answers to start from.
  useEffect(() => {
    if (token) api.getProfile(token).then((p) => setInitial(p.data)).catch(() => router.back());
  }, [token, router]);

  if (!initial) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  return user?.role === 'owner' ? (
    <OwnerOnboardingFlow initial={initial} onComplete={() => router.back()} />
  ) : (
    <ProfessionalOnboardingFlow initial={initial} onComplete={() => router.back()} />
  );
}
