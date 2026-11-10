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
