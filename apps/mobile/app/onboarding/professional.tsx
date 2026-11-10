import { type Href, useRouter } from 'expo-router';

import { ProfessionalOnboardingFlow } from '@/features/onboarding-pro/professional-onboarding';

// Route for the professional onboarding form.
export default function ProfessionalOnboardingScreen() {
  const router = useRouter();
  return <ProfessionalOnboardingFlow onComplete={() => router.replace('/' as Href)} />;
}
