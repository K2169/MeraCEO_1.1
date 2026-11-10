import { type Href, useRouter } from 'expo-router';

import { OwnerOnboardingFlow } from '@/features/onboarding-owner/owner-onboarding';

// Route for the owner onboarding form.
export default function OwnerOnboardingScreen() {
  const router = useRouter();
  // Back to the splash, which now sends the owner on to consent.
  return <OwnerOnboardingFlow onComplete={() => router.replace('/' as Href)} />;
}
