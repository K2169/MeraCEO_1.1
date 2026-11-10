import type { ExpertiseId, FeeBand, Format, IndustryId } from './enums';
import { FEE_BANDS } from './enums';

// What matching needs to know about a need.
export interface MatchNeed {
  expertise: readonly ExpertiseId[];
  industry: IndustryId;
  budgetBand: FeeBand;
  format?: Format;
}

// What matching needs to know about a professional.
export interface MatchProfessional {
  expertise: readonly ExpertiseId[];
  industry: IndustryId;
  feeBand: FeeBand;
  formats: readonly Format[];
}

// Why a professional matched. The app turns each reason into a short sentence.
export type MatchReason = 'expertise' | 'industry' | 'budget' | 'format';

export interface MatchResult {
  score: number; // 0 to 100. 0 means no match.
  reasons: MatchReason[];
  matchedExpertise: ExpertiseId[]; // the expertise areas both sides share
}

// Fixed, easy-to-explain weights (ported from the first prototype). No learning, no network.
export const MATCH_WEIGHTS = { expertise: 60, industry: 20, budget: 15, format: 5 } as const;

// Scores one professional against one need.
// Expertise is required: a cheap fee or the same industry alone never creates a match.
export function matchProfessional(pro: MatchProfessional, need: MatchNeed): MatchResult {
  const wanted = new Set(need.expertise);
  const shared = [...wanted].filter((id) => pro.expertise.includes(id));
  if (shared.length === 0) return { score: 0, reasons: [], matchedExpertise: [] };

  // Expertise points are split by how much of the need the professional covers.
  let score = Math.round((MATCH_WEIGHTS.expertise * shared.length) / wanted.size);
  const reasons: MatchReason[] = ['expertise'];

  if (pro.industry === need.industry) {
    score += MATCH_WEIGHTS.industry;
    reasons.push('industry');
  }
  // The fee band is a coarse signal: the professional fits when their band is at or below the budget.
  if (FEE_BANDS.indexOf(pro.feeBand) <= FEE_BANDS.indexOf(need.budgetBand)) {
    score += MATCH_WEIGHTS.budget;
    reasons.push('budget');
  }
  if (need.format && pro.formats.includes(need.format)) {
    score += MATCH_WEIGHTS.format;
    reasons.push('format');
  }
  return { score, reasons, matchedExpertise: shared };
}

// Orders matches best first. Equal scores keep a stable order by id so lists do not jump around.
export function rankMatches<T extends { score: number; id: string }>(items: readonly T[]): T[] {
  return items.filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, 'en'));
}
