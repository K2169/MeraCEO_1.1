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

export const GENDER_OPTIONS = ['woman', 'man', 'other', 'prefer_not_to_say'] as const;
const gender = z.enum(GENDER_OPTIONS);

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const expertiseList = z.array(z.enum(EXPERTISE_IDS)).min(1).max(5);

// A mobile number: digits with an optional leading +, spaces or dashes. Kept private (never shown in lists).
const phone = z.string().trim().regex(/^\+?[\d\s-]{7,16}$/);
// A web address with or without https://, for example "sharmatraders.in" or "https://sharmatraders.in".
const website = z.string().trim().max(200).regex(/^(https?:\/\/)?[^\s/.]+(\.[^\s/.]+)+(\/\S*)?$/);
// A LinkedIn profile link.
const linkedin = z.string().trim().max(200).regex(/^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\/\S+$/i);
const year = z.string().trim().regex(/^(19|20)\d{2}$/);
const month = z.string().trim().regex(/^(19|20)\d{2}-(0[1-9]|1[0-2])$/);
const time = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const consultationDuration = z.union([z.literal(30), z.literal(60), z.literal(90)]);
const timezone = z.string().trim().min(1).max(64).refine((value) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
});

const employmentEntry = z.object({
  id: z.string().trim().min(1).max(64),
  title: text(2, 120),
  organization: text(2, 120),
  startDate: month,
  endDate: month.optional(),
  current: z.boolean(),
}).superRefine((entry, ctx) => {
  if (entry.current && entry.endDate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'current_role_has_no_end_date' });
  if (!entry.current && !entry.endDate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'end_date_required' });
  if (entry.endDate && entry.endDate < entry.startDate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'end_date_before_start_date' });
});

const educationEntry = z.object({
  id: z.string().trim().min(1).max(64),
  qualification: z.enum(QUALIFICATIONS),
  institution: text(2, 120),
  fieldOfStudy: text(2, 120).optional(),
  completionYear: year.optional(),
});

const certificationEntry = z.object({
  id: z.string().trim().min(1).max(64),
  name: text(2, 120),
  issuer: text(2, 120),
  issueYear: year.optional(),
});

const availabilityWindow = z.object({
  id: z.string().trim().min(1).max(64),
  day: z.enum(DAYS),
  startTime: time,
  endTime: time,
}).superRefine((window, ctx) => {
  if (window.endTime <= window.startTime) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endTime'], message: 'availability_end_must_follow_start' });
});

const validateAvailabilityWindows = (windows: z.infer<typeof availabilityWindow>[], ctx: z.RefinementCtx) => {
  const ids = new Set<string>();
  windows.forEach((window, index) => {
    if (ids.has(window.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'id'], message: 'duplicate_availability_id' });
    ids.add(window.id);
    for (let prior = 0; prior < index; prior += 1) {
      const other = windows[prior]!;
      if (window.day === other.day && window.startTime < other.endTime && other.startTime < window.endTime) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'startTime'], message: 'availability_windows_overlap' });
      }
    }
  });
};
const availabilityWindows = z.array(availabilityWindow).max(28).superRefine(validateAvailabilityWindows);

// Owner onboarding: business details, size and place, the owner, a first need, budget, review (submit).
const ownerOnboardingBaseSchema = z.object({
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
  gender: gender.optional(),
  designation: text(2, 80),
  yearsInBusiness: z.number().int().min(0).max(80),
  ownerBio: text(1, 300).optional(),
  phone: phone.optional(),
  linkedin: linkedin.optional(),
  qualification: z.enum(QUALIFICATIONS).optional(),
  // First need
  needTitle: text(5, 120),
  challenge: text(20, 1000),
  needTimeline: text(2, 120).optional(),
  goals: text(10, 600).optional(),
  needExpertise: expertiseList,
  // Exact support budgets coexist with the coarse matching band on legacy records.
  supportBudgets: z.array(z.object({
    expertise: z.enum(EXPERTISE_IDS),
    budget: z.enum(['below_5000', '5000_25000', '25000_100000', 'above_100000']),
  })).max(5).optional(),
  // Budget and format
  budgetBand: z.enum(FEE_BANDS),
  preferredFormat: z.enum(FORMATS).optional(),
});
const validateSupportBudgets = (profile: z.infer<typeof ownerOnboardingBaseSchema>, ctx: z.RefinementCtx) => {
  if (profile.supportBudgets === undefined) return;
  const areas = new Set(profile.supportBudgets.map((entry) => entry.expertise));
  if (areas.size !== profile.supportBudgets.length || profile.needExpertise.some((area) => !areas.has(area)) || profile.supportBudgets.some((entry) => !profile.needExpertise.includes(entry.expertise))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['supportBudgets'], message: 'one_budget_per_selected_support_area' });
  }
};
export const ownerOnboardingSchema = ownerOnboardingBaseSchema.superRefine(validateSupportBudgets);
export const ownerRegistrationSchema = ownerOnboardingBaseSchema.extend({
  gender,
  description: text(20, 300),
  challenge: text(20, 500),
  goals: text(10, 500),
  needTimeline: text(2, 120),
  supportBudgets: z.array(z.object({ expertise: z.enum(EXPERTISE_IDS), budget: z.enum(['below_5000', '5000_25000', '25000_100000', 'above_100000']) })).min(1).max(5),
}).superRefine(validateSupportBudgets);
export type OwnerOnboarding = z.infer<typeof ownerOnboardingSchema>;

// Professional onboarding: personal details, experience, credentials and skills, expertise and availability, review.
const professionalOnboardingBaseSchema = z.object({
  // Personal
  name: text(2, 80),
  displayName: text(2, 80).optional(),
  discreetMode: z.boolean().optional(),
  gender: gender.optional(),
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
  employmentHistory: z.array(employmentEntry).max(20).optional(),
  educationHistory: z.array(educationEntry).max(20).optional(),
  certifications: z.array(certificationEntry).max(20).optional(),
  skills: z.array(text(2, 40)).min(1).max(10),
  // Expertise and availability
  expertise: expertiseList,
  industriesAdvised: z.array(z.enum(INDUSTRY_IDS)).max(5).optional(),
  preferredTeamSizes: z.array(z.enum(TEAM_SIZES)).max(TEAM_SIZES.length).optional(),
  preferredRevenueBands: z.array(z.enum(REVENUE_BANDS)).max(REVENUE_BANDS.length).optional(),
  feeBand: z.enum(FEE_BANDS),
  formats: z.array(z.enum(FORMATS)).min(1),
  durationMinutes: consultationDuration.optional(),
  engagementType: z.enum(ENGAGEMENT_TYPES),
  days: z.array(z.enum(DAYS)).min(1),
  timeSlots: text(3, 60).optional(),
  availabilityWindows: availabilityWindows.optional(),
  timezone: timezone.optional(),
  // Disclaimer and terms are required before submit (PRD section 05/06).
  disclaimerAccepted: z.literal(true),
  termsAccepted: z.literal(true),
});
const validateAvailabilityTimezonePair = (
  profile: { availabilityWindows?: z.infer<typeof availabilityWindows>; timezone?: string },
  ctx: z.RefinementCtx,
) => {
  if (profile.availabilityWindows !== undefined && !profile.timezone) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['timezone'], message: 'availability_timezone_required' });
  }
};

const validateDiscreetMode = (profile: { displayName?: string; discreetMode?: boolean }, ctx: z.RefinementCtx) => {
  if (profile.discreetMode === true && !profile.displayName?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['displayName'], message: 'discreet_display_name_required' });
  }
};

export const professionalOnboardingSchema = professionalOnboardingBaseSchema.superRefine((profile, ctx) => {
  validateAvailabilityTimezonePair(profile, ctx);
  validateDiscreetMode(profile, ctx);
});
export type ProfessionalOnboarding = z.infer<typeof professionalOnboardingSchema>;

// New registrations must supply structured availability and its timezone. The base schema remains
// backward-compatible with saved records; profile edits can add those fields without losing legacy data.
export const professionalRegistrationSchema = professionalOnboardingBaseSchema.extend({
  gender,
  displayName: text(2, 80),
  discreetMode: z.boolean(),
  durationMinutes: consultationDuration,
  availabilityWindows: z.array(availabilityWindow).min(1).max(28).superRefine(validateAvailabilityWindows),
  timezone,
}).superRefine((profile, ctx) => {
  validateAvailabilityTimezonePair(profile, ctx);
  validateDiscreetMode(profile, ctx);
  const windowDays = new Set(profile.availabilityWindows.map((window) => window.day));
  const selectedDays = new Set(profile.days);
  const hasDuplicateDays = selectedDays.size !== profile.days.length;
  if (hasDuplicateDays || windowDays.size !== selectedDays.size || [...windowDays].some((day) => !selectedDays.has(day))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['days'], message: 'availability_days_must_match_windows' });
  }
});
export type ProfessionalRegistration = z.infer<typeof professionalRegistrationSchema>;
