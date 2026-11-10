import { z } from 'zod';
import {
  BUSINESS_TYPES,
  DAYS,
  EMPLOYMENT_TYPES,
  ENGAGEMENT_TYPES,
  EXPERTISE_IDS,
  FEE_BANDS,
  FORMATS,
  INDUSTRY_IDS,
  QUALIFICATIONS,
  REGISTRATION_TYPES,
  REVENUE_BANDS,
  SECTORS,
  TEAM_SIZES,
} from '../enums';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const expertiseList = z.array(z.enum(EXPERTISE_IDS)).min(1).max(5);

// A mobile number: digits with an optional leading +, spaces or dashes. Kept private (never shown in lists).
const phone = z.string().trim().regex(/^\+?[\d\s-]{7,16}$/);
// A web address with or without https://, for example "sharmatraders.in" or "https://sharmatraders.in".
const website = z.string().trim().max(200).regex(/^(https?:\/\/)?[^\s/.]+(\.[^\s/.]+)+(\/\S*)?$/);
// A LinkedIn profile link.
const linkedin = z.string().trim().max(200).regex(/^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\/\S+$/i);
const year = z.string().trim().regex(/^(19|20)\d{2}$/);

// Owner onboarding: business details, size and place, the owner, a first need, budget, review (submit).
export const ownerOnboardingSchema = z.object({
  // Business
  businessName: text(2, 120),
  industry: z.enum(INDUSTRY_IDS),
  businessType: z.enum(BUSINESS_TYPES),
  registrationType: z.enum(REGISTRATION_TYPES),
  sector: z.enum(SECTORS).optional(),
  yearEstablished: year.optional(),
  website: website.optional(),
  description: text(20, 600),
  // Place and size
  country: text(2, 80),
  // Only some countries have states in our list, so the state is optional.
  state: text(2, 80).optional(),
  city: text(2, 80),
  revenue: z.enum(REVENUE_BANDS),
  teamSize: z.enum(TEAM_SIZES),
  // The owner
  ownerName: text(2, 80),
  designation: text(2, 80),
  yearsInBusiness: z.number().int().min(0).max(80),
  phone: phone.optional(),
  linkedin: linkedin.optional(),
  qualification: z.enum(QUALIFICATIONS).optional(),
  // First need
  needTitle: text(5, 120),
  challenge: text(20, 1000),
  goals: text(10, 600).optional(),
  needExpertise: expertiseList,
  // Budget and format
  budgetBand: z.enum(FEE_BANDS),
  preferredFormat: z.enum(FORMATS).optional(),
});
export type OwnerOnboarding = z.infer<typeof ownerOnboardingSchema>;

// Professional onboarding: personal details, experience, credentials and skills, expertise and availability, review.
export const professionalOnboardingSchema = z.object({
  // Personal
  name: text(2, 80),
  phone: phone.optional(),
  country: text(2, 80),
  // Only some countries have states in our list, so the state is optional.
  state: text(2, 80).optional(),
  city: text(2, 80),
  linkedin: linkedin.optional(),
  // Experience
  headline: text(5, 120),
  designation: text(2, 80),
  company: text(2, 120),
  yearsExperience: z.number().int().min(0).max(60),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  industry: z.enum(INDUSTRY_IDS),
  experience: text(20, 1000),
  // Credentials and skills
  qualification: z.enum(QUALIFICATIONS),
  workHistory: text(10, 1500).optional(),
  skills: z.array(text(2, 40)).min(1).max(10),
  // Expertise and availability
  expertise: expertiseList,
  industriesAdvised: z.array(z.enum(INDUSTRY_IDS)).max(5).optional(),
  feeBand: z.enum(FEE_BANDS),
  formats: z.array(z.enum(FORMATS)).min(1),
  engagementType: z.enum(ENGAGEMENT_TYPES),
  days: z.array(z.enum(DAYS)).min(1),
  timeSlots: text(3, 60).optional(),
  // Disclaimer and terms are required before submit (PRD section 05/06).
  disclaimerAccepted: z.literal(true),
  termsAccepted: z.literal(true),
});
export type ProfessionalOnboarding = z.infer<typeof professionalOnboardingSchema>;
