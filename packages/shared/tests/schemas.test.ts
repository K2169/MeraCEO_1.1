import { describe, expect, it } from 'vitest';
import { createRequestSchema, ownerOnboardingSchema, professionalOnboardingSchema, professionalRegistrationSchema } from '../src';

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

  it('requires structured availability and validates overlapping time windows for new registrations', () => {
    const registration = {
      ...pro,
      gender: 'prefer_not_to_say',
      days: ['mon'] as const,
      durationMinutes: 60,
      timezone: 'Asia/Kolkata',
      availabilityWindows: [{ id: 'mon-am', day: 'mon', startTime: '09:00', endTime: '12:00' }],
    };
    expect(professionalRegistrationSchema.safeParse(registration).success).toBe(true);
    expect(professionalRegistrationSchema.safeParse({ ...registration, gender: undefined }).success).toBe(false);
    expect(professionalRegistrationSchema.safeParse({ ...registration, gender: 'invalid' }).success).toBe(false);
    expect(professionalRegistrationSchema.safeParse({ ...registration, timezone: 'Not/AZone' }).success).toBe(false);
    expect(professionalRegistrationSchema.safeParse({ ...registration, availabilityWindows: [] }).success).toBe(false);
    expect(professionalRegistrationSchema.safeParse({ ...registration, days: ['mon', 'tue'] }).success).toBe(false);
    expect(professionalRegistrationSchema.safeParse({ ...registration, days: ['mon', 'mon'] }).success).toBe(false);
    expect(professionalRegistrationSchema.safeParse({
      ...registration,
      availabilityWindows: [
        ...registration.availabilityWindows,
        { id: 'mon-midday', day: 'mon', startTime: '11:00', endTime: '13:00' },
      ],
    }).success).toBe(false);
  });

  it('requires a time zone when an existing profile supplies structured availability', () => {
    const profile = {
      ...pro,
      days: ['mon', 'tue'],
      availabilityWindows: [{ id: 'mon-am', day: 'mon', startTime: '09:00', endTime: '12:00' }],
    };
    expect(professionalOnboardingSchema.safeParse({ ...profile, timezone: 'Asia/Kolkata' }).success).toBe(true);
    expect(professionalOnboardingSchema.safeParse({ ...profile, timezone: undefined }).success).toBe(false);
    expect(professionalOnboardingSchema.safeParse({ ...pro, timezone: 'Asia/Kolkata' }).success).toBe(true);
  });

  it('validates date ranges in repeatable professional history', () => {
    const history = {
      ...pro,
      employmentHistory: [{ id: 'role-1', title: 'Advisor', organization: 'Mera', startDate: '2020-01', endDate: '2021-01', current: false }],
    };
    expect(professionalOnboardingSchema.safeParse(history).success).toBe(true);
    expect(professionalOnboardingSchema.safeParse({
      ...history,
      employmentHistory: [{ ...history.employmentHistory[0], endDate: '2019-12' }],
    }).success).toBe(false);
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
