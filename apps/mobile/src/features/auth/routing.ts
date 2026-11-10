import type { Href } from 'expo-router';

import type { Me } from '@/lib/api';

// Decides the first screen for a signed-in user. Order follows the plan:
// age check (W2-08) -> role (W2-04) -> onboarding (W3-01/02) -> consent (W3-04) -> dashboard.
export function nextRoute(user: Me): Href {
  if (user.ageConfirmed === false) return '/age-blocked' as Href;
  if (!user.dateOfBirthSet) return '/age' as Href;
  if (user.ageConfirmed == null) return '/age' as Href;
  if (user.role == null) return '/role' as Href;
  if (!user.profileComplete) return (user.role === 'owner' ? '/onboarding/owner' : '/onboarding/professional') as Href;
  if (!user.consentDone) return '/consent' as Href;
  return (user.role === 'owner' ? '/dashboard/owner' : '/dashboard/professional') as Href;
}
