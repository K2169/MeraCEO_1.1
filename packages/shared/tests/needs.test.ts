import { describe, expect, it } from 'vitest';

import { createNeedSchema } from '../src';

const need = { title: 'Grow the business', challenge: 'We want advice on growing our business sustainably.', timeline: 'Next quarter', expertise: ['strategy'], industry: 'retail' };

describe('owner need write contract', () => {
  it('requires a timeline and caps the description at 500 characters', () => {
    expect(createNeedSchema.safeParse(need).success).toBe(true);
    expect(createNeedSchema.safeParse({ ...need, timeline: undefined }).success).toBe(false);
    expect(createNeedSchema.safeParse({ ...need, challenge: 'a'.repeat(501) }).success).toBe(false);
    expect(createNeedSchema.safeParse({ ...need, challenge: 'a'.repeat(500) }).success).toBe(true);
  });
  it('accepts an unspecified budget and validates a supplied band', () => {
    expect(createNeedSchema.safeParse(need).success).toBe(true);
    expect(createNeedSchema.safeParse({ ...need, budgetBand: 'mid' }).success).toBe(true);
    expect(createNeedSchema.safeParse({ ...need, budgetBand: 'unlimited' }).success).toBe(false);
  });
});
