import { describe, expect, it } from 'vitest';
import { createRequestSchema, ownerOnboardingSchema, professionalOnboardingSchema } from '../src';

const owner = {
  businessName: 'Sharma Traders',
  industry: 'retail',
  country: 'India',
  state: 'Maharashtra',
  city: 'Mumbai',
  ownerName: 'Rajesh Sharma',
  businessType: 'private_limited',
  registrationType: 'gst_registered',
  description: 'We make and sell packaged food through distributors across Maharashtra.',
  revenue: '1_10_cr',
  teamSize: '11_50',
  designation: 'Founder',
  yearsInBusiness: 12,
  needTitle: 'Grow online sales',
  challenge: 'We sell through distributors and want a direct online channel.',
  needExpertise: ['sales', 'marketing'],
  budgetBand: 'mid',
};

const pro = {
  name: 'Neha Mehta',
  country: 'India',
  state: 'Maharashtra',
  city: 'Pune',
  headline: 'Growth consultant',
  designation: 'Independent consultant',
  company: 'Mehta Growth Advisory',
  yearsExperience: 15,
  employmentType: 'independent',
  qualification: 'mba',
  skills: ['D2C', 'Retail growth'],
  engagementType: 'both',
  days: ['mon', 'tue'],
  experience: 'Fifteen years scaling D2C and retail brands across India.',
  expertise: ['marketing'],
  industry: 'retail',
  feeBand: 'low',
  formats: ['online'],
  disclaimerAccepted: true,
  termsAccepted: true,
};

describe('onboarding schemas', () => {
  it('lets the state be left out for countries without states, but not the country', () => {
    expect(ownerOnboardingSchema.safeParse({ ...owner, state: undefined }).success).toBe(true);
    expect(professionalOnboardingSchema.safeParse({ ...pro, country: undefined }).success).toBe(false);
  });

  it('accepts optional details when valid and rejects them when malformed', () => {
    const extras = { website: 'sharmatraders.in', phone: '+91 98765 43210', linkedin: 'https://www.linkedin.com/in/rajesh', yearEstablished: '2011', goals: 'Open an online store in six months.' };
    expect(ownerOnboardingSchema.safeParse({ ...owner, ...extras }).success).toBe(true);
    expect(ownerOnboardingSchema.safeParse({ ...owner, website: 'not a site' }).success).toBe(false);
    expect(ownerOnboardingSchema.safeParse({ ...owner, phone: 'abc' }).success).toBe(false);
    expect(ownerOnboardingSchema.safeParse({ ...owner, yearEstablished: '1850' }).success).toBe(false);
    expect(professionalOnboardingSchema.safeParse({ ...pro, linkedin: 'https://example.com/me' }).success).toBe(false);
  });

  it('needs at least one skill and one available day for a professional', () => {
    expect(professionalOnboardingSchema.safeParse({ ...pro, skills: [] }).success).toBe(false);
    expect(professionalOnboardingSchema.safeParse({ ...pro, days: [] }).success).toBe(false);
  });

  it('accepts a complete owner onboarding', () => {
    expect(ownerOnboardingSchema.safeParse(owner).success).toBe(true);
  });

  it('requires at least one expertise area for an owner need', () => {
    expect(ownerOnboardingSchema.safeParse({ ...owner, needExpertise: [] }).success).toBe(false);
  });

  it('blocks professional submit until disclaimer and terms are accepted', () => {
    expect(
      professionalOnboardingSchema.safeParse({ ...pro, disclaimerAccepted: false }).success,
    ).toBe(false);
    expect(professionalOnboardingSchema.safeParse({ ...pro, termsAccepted: false }).success).toBe(
      false,
    );
    expect(professionalOnboardingSchema.safeParse(pro).success).toBe(true);
  });
});

describe('createRequestSchema', () => {
  it('requires a need and a professional, and caps the note length', () => {
    expect(createRequestSchema.safeParse({ needId: 'n1', professionalId: 'p1' }).success).toBe(true);
    expect(createRequestSchema.safeParse({ needId: '', professionalId: 'p1' }).success).toBe(false);
    expect(
      createRequestSchema.safeParse({ needId: 'n1', professionalId: 'p1', note: 'x'.repeat(501) })
        .success,
    ).toBe(false);
  });
});
