export interface NeedIdentityInput {
  title?: string;
  challenge?: string;
  expertise?: readonly string[];
  industry?: string;
}

export interface ExistingNeedIdentity extends NeedIdentityInput {
  id: string;
  status: 'open' | 'closed';
}

function normalize(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function needDuplicateContextIdentity(need: NeedIdentityInput): string | null {
  const title = need.title?.trim();
  const challenge = need.challenge?.trim();
  if (!title || !challenge || !need.industry) return null;
  return JSON.stringify([normalize(title), normalize(challenge), need.industry]);
}

// Keep this identity shared by the mobile duplicate hint and the API guard.
// Budget, format, timeline, and goals can change without making the underlying need a new need.
export function needDuplicateIdentity(need: NeedIdentityInput): string | null {
  const expertise = need.expertise;
  const context = needDuplicateContextIdentity(need);
  if (!context || !expertise?.length) return null;

  return JSON.stringify([context, [...new Set(expertise)].sort()]);
}

export function matchingOpenNeedExpertise(
  candidate: NeedIdentityInput,
  existing: readonly ExistingNeedIdentity[],
  excludeId?: string,
): string[] {
  const context = needDuplicateContextIdentity(candidate);
  if (!context) return [];
  const expertise = new Set<string>();
  for (const need of existing) {
    if (need.status === 'open' && need.id !== excludeId && needDuplicateContextIdentity(need) === context) {
      need.expertise?.forEach((id) => expertise.add(id));
    }
  }
  return [...expertise];
}

export function isDuplicateOpenNeed(
  candidate: NeedIdentityInput,
  existing: readonly ExistingNeedIdentity[],
  excludeId?: string,
): boolean {
  const identity = needDuplicateIdentity(candidate);
  if (!identity) return false;
  return existing.some((need) => need.status === 'open'
    && need.id !== excludeId
    && needDuplicateIdentity(need) === identity);
}
