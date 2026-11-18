import { describe, expect, it } from 'vitest';

import { matchProfessional, rankMatches } from '../src/matching';

const need = { expertise: ['marketing', 'sales'] as const, industry: 'retail' as const, budgetBand: 'mid' as const, format: 'online' as const };
const pro = { expertise: ['marketing', 'sales'] as const, industry: 'retail' as const, feeBand: 'low' as const, formats: ['online' as const] };

describe('matchProfessional', () => {
  it('gives 100 when everything lines up and explains why', () => {
    const result = matchProfessional(pro, need);
    expect(result.score).toBe(100);
    expect(result.reasons).toEqual(['expertise', 'industry', 'budget', 'format']);
    expect(result.matchedExpertise).toEqual(['marketing', 'sales']);
  });

  it('scores covering half the need lower than covering all of it', () => {
    expect(matchProfessional({ ...pro, expertise: ['marketing'] }, need).score).toBe(70);
  });

  it('scores zero without shared expertise, even if everything else fits', () => {
    expect(matchProfessional({ ...pro, expertise: ['legal'] }, need)).toEqual({ score: 0, reasons: [], matchedExpertise: [] });
  });

  it('only gives budget points when the fee band is within the budget', () => {
    expect(matchProfessional({ ...pro, feeBand: 'high' }, need).score).toBe(85);
    expect(matchProfessional({ ...pro, feeBand: 'mid' }, need).score).toBe(100);
  });

  it('gives no format points when the need has no preferred format', () => {
    const noFormat = { expertise: need.expertise, industry: need.industry, budgetBand: need.budgetBand };
    expect(matchProfessional(pro, noFormat).score).toBe(95);
  });

  it('matches a PRD advisory industry in addition to the professional\'s primary industry', () => {
    const advisor = { ...pro, industry: 'manufacturing' as const, industriesAdvised: ['retail'] as const };
    expect(matchProfessional(advisor, need).reasons).toContain('industry');
    expect(matchProfessional(advisor, need).score).toBe(100);
  });

  it('adds a business-profile fit when the owner stage is explicitly preferred', () => {
    const profileNeed = {
      ...need,
      businessProfile: { teamSize: '2_10' as const, revenue: 'lt_10_lakh' as const },
    };
    const advisor = {
      ...pro,
      feeBand: 'high' as const,
      preferredTeamSizes: ['2_10'] as const,
      preferredRevenueBands: ['lt_10_lakh'] as const,
    };
    const result = matchProfessional(advisor, profileNeed);
    expect(result.score).toBe(90);
    expect(result.reasons).toContain('business_profile');
  });

  it('does not infer a business-profile fit when owner data is missing', () => {
    const advisor = { ...pro, preferredTeamSizes: ['2_10'] as const };
    const result = matchProfessional(advisor, need);
    expect(result.reasons).not.toContain('business_profile');
    expect(result.score).toBe(100);
  });
});

describe('rankMatches', () => {
  it('sorts best first, drops zero scores and keeps ties in a stable order', () => {
    const ranked = rankMatches([
      { id: 'b', score: 60 },
      { id: 'z', score: 0 },
      { id: 'a', score: 60 },
      { id: 'c', score: 90 },
    ]);
    expect(ranked.map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });
});
