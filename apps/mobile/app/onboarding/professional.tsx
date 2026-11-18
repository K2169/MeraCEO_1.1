import { Redirect, type Href, useRouter } from 'expo-router';

import { useSession } from '@/features/auth/session-provider';
import { ProfessionalOnboardingFlow } from '@/features/onboarding-pro/professional-onboarding';

// Route for the professional onboarding form.
export default function ProfessionalOnboardingScreen() {
  const router = useRouter();
  const { loading, user } = useSession();
  if (loading) return null;
  if (!user || user.role === 'owner' || user.ageConfirmed === false) return <Redirect href="/" />;
  return <ProfessionalOnboardingFlow onComplete={() => router.replace('/' as Href)} />;
}
