import { describe, expect, it } from 'vitest';
import { ownerOnboardingSchema, ownerRegistrationSchema } from '../src';

const owner = {
  businessName: 'Sharma Traders', industry: 'retail', businessType: 'private_limited', registrationType: 'gst_registered',
  description: 'We sell packaged food through distributors across Maharashtra.', country: 'India', city: 'Mumbai',
  revenue: '1_10_cr', teamSize: '11_50', ownerName: 'Rajesh Sharma', designation: 'Founder', yearsInBusiness: 12,
  needTitle: 'Grow online sales', challenge: 'We want help building an online sales channel.', needExpertise: ['marketing', 'sales'], budgetBand: 'mid',
};

describe('owner PRD registration data', () => {
  it('reads legacy profiles and stores detailed budgets without losing the matching band', () => {
    expect(ownerOnboardingSchema.safeParse(owner).success).toBe(true);
    const profile = { ...owner, ownerBio: 'I founded this business twelve years ago.', needTimeline: 'Within six months', supportBudgets: [{ expertise: 'marketing', budget: '5000_25000' }, { expertise: 'sales', budget: 'above_100000' }] };
    expect(ownerOnboardingSchema.safeParse(profile).success).toBe(true);
    expect(ownerOnboardingSchema.safeParse({ ...profile, supportBudgets: [profile.supportBudgets[0]] }).success).toBe(false);
    expect(ownerOnboardingSchema.safeParse({ ...profile, supportBudgets: [profile.supportBudgets[0], profile.supportBudgets[0]] }).success).toBe(false);
  });

  it('requires new registration timeline, goals and complete support budgets', () => {
    expect(ownerRegistrationSchema.safeParse(owner).success).toBe(false);
    const registration = { ...owner, gender: 'prefer_not_to_say', needTimeline: 'This quarter', goals: 'Build a sustainable online channel.', supportBudgets: [{ expertise: 'marketing', budget: '5000_25000' }, { expertise: 'sales', budget: 'above_100000' }] };
    expect(ownerRegistrationSchema.safeParse(registration).success).toBe(true);
    expect(ownerRegistrationSchema.safeParse({ ...registration, gender: undefined }).success).toBe(false);
    expect(ownerRegistrationSchema.safeParse({ ...registration, gender: 'invalid' }).success).toBe(false);
    expect(ownerRegistrationSchema.safeParse({ ...registration, needTimeline: undefined }).success).toBe(false);
  });

  it('enforces PRD text limits and rejects unrecognised budget slabs', () => {
    const complete = { ...owner, gender: 'woman', needTimeline: 'Next quarter', goals: 'Build an online sales channel.', supportBudgets: [{ expertise: 'marketing', budget: '5000_25000' }, { expertise: 'sales', budget: 'above_100000' }] };
    expect(ownerRegistrationSchema.safeParse(complete).success).toBe(true);
    expect(ownerOnboardingSchema.safeParse({ ...owner, ownerBio: 'a'.repeat(301) }).success).toBe(false);
    expect(ownerRegistrationSchema.safeParse({ ...complete, description: 'a'.repeat(301) }).success).toBe(false);
    expect(ownerOnboardingSchema.safeParse({ ...owner, description: 'a'.repeat(301) }).success).toBe(true);
    expect(ownerRegistrationSchema.safeParse({ ...complete, challenge: 'a'.repeat(501) }).success).toBe(false);
    expect(ownerRegistrationSchema.safeParse({ ...complete, goals: 'a'.repeat(501) }).success).toBe(false);
    expect(ownerOnboardingSchema.safeParse({ ...owner, supportBudgets: [{ expertise: 'marketing', budget: 'unlimited' }] }).success).toBe(false);
  });
});
