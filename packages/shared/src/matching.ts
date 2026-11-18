import type { ExpertiseId, FeeBand, Format, IndustryId, RevenueBand, TeamSize } from './enums';
import { FEE_BANDS } from './enums';

// What matching needs to know about a need.
export interface MatchNeed {
  expertise: readonly ExpertiseId[];
  industry: IndustryId;
  budgetBand?: FeeBand;
  format?: Format;
  // The business profile whose need is being matched, when available.
  businessProfile?: { teamSize?: TeamSize; revenue?: RevenueBand };
}

// What matching needs to know about a professional.
export interface MatchProfessional {
  expertise: readonly ExpertiseId[];
  industry: IndustryId;
  industriesAdvised?: readonly IndustryId[];
  feeBand: FeeBand;
  formats: readonly Format[];
  preferredTeamSizes?: readonly TeamSize[];
  preferredRevenueBands?: readonly RevenueBand[];
}

// Why a professional matched. The app turns each reason into a short sentence.
export type MatchReason = 'expertise' | 'industry' | 'budget' | 'format' | 'business_profile';

export interface MatchResult {
  score: number; // 0 to 100. 0 means no match.
  reasons: MatchReason[];
  matchedExpertise: ExpertiseId[]; // the expertise areas both sides share
}

// Fixed, easy-to-explain weights (ported from the first prototype). No learning, no network.
export const MATCH_WEIGHTS = { expertise: 60, industry: 20, budget: 15, format: 5 } as const;
const BUSINESS_PROFILE_BONUS = 5;

// Scores one professional against one need.
// Expertise is required: a cheap fee or the same industry alone never creates a match.
export function matchProfessional(pro: MatchProfessional, need: MatchNeed): MatchResult {
  const wanted = new Set(need.expertise);
  const shared = [...wanted].filter((id) => pro.expertise.includes(id));
  if (shared.length === 0) return { score: 0, reasons: [], matchedExpertise: [] };

  // Expertise points are split by how much of the need the professional covers.
  let score = Math.round((MATCH_WEIGHTS.expertise * shared.length) / wanted.size);
  const reasons: MatchReason[] = ['expertise'];

  if (pro.industry === need.industry || pro.industriesAdvised?.includes(need.industry)) {
    score += MATCH_WEIGHTS.industry;
    reasons.push('industry');
  }
  // The fee band is a coarse signal: the professional fits when their band is at or below the budget.
  if (need.budgetBand && FEE_BANDS.indexOf(pro.feeBand) <= FEE_BANDS.indexOf(need.budgetBand)) {
    score += MATCH_WEIGHTS.budget;
    reasons.push('budget');
  }
  if (need.format && pro.formats.includes(need.format)) {
    score += MATCH_WEIGHTS.format;
    reasons.push('format');
  }

  // Give a small, explainable bonus when the professional has opted to work with
  // this owner's business size or revenue stage. Missing owner profile data never
  // counts as a match. Cap at 100 to preserve the public score contract.
  const profileFit = Boolean(
    (need.businessProfile?.teamSize && pro.preferredTeamSizes?.includes(need.businessProfile.teamSize))
    || (need.businessProfile?.revenue && pro.preferredRevenueBands?.includes(need.businessProfile.revenue)),
  );
  if (profileFit) reasons.push('business_profile');

  return { score: Math.min(100, score + (profileFit ? BUSINESS_PROFILE_BONUS : 0)), reasons, matchedExpertise: shared };
}

// Orders matches best first. Equal scores keep a stable order by id so lists do not jump around.
export function rankMatches<T extends { score: number; id: string }>(items: readonly T[]): T[] {
  return items.filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, 'en'));
}
