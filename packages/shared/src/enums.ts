// Contract values shared by the app and tests. Labels live in apps/mobile/src/i18n, never here.

// The two account roles.
export const ROLES = ['owner', 'professional'] as const;
export type Role = (typeof ROLES)[number];

export const MODERATION_STATUSES = ['pending_review', 'approved', 'hidden'] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const REQUEST_STATUSES = ['pending', 'accepted', 'declined', 'cancelled', 'completed'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_ACTIONS = ['accept', 'decline', 'cancel', 'complete'] as const;
export type RequestAction = (typeof REQUEST_ACTIONS)[number];

export const NEED_STATUSES = ['open', 'closed'] as const;
export type NeedStatus = (typeof NEED_STATUSES)[number];

// Advisory budget for owners; professional fee band for consultants. Same scale so they compare.
export const FEE_BANDS = ['low', 'mid', 'high'] as const;
export type FeeBand = (typeof FEE_BANDS)[number];

// Consultation formats offered.
export const FORMATS = ['online', 'in_person', 'phone'] as const;
export type Format = (typeof FORMATS)[number];

export const EXPERTISE_IDS = [
  'strategy',
  'marketing',
  'finance',
  'operations',
  'hr',
  'legal',
  'technology',
  'sales',
  'product',
  'international',
] as const;
export type ExpertiseId = (typeof EXPERTISE_IDS)[number];

export const INDUSTRY_IDS = [
  'retail',
  'manufacturing',
  'healthcare',
  'education',
  'hospitality',
  'it_services',
  'logistics',
  'real_estate',
  'professional_services',
  'it_hardware',
  'food_beverage',
  'financial_services',
  'agriculture',
  'fashion_lifestyle',
  'media_marketing',
  'entertainment',
  'automobile',
  'energy',
  'telecom_electronics',
  'beauty_care',
  'textiles',
  'pharma_chemicals',
  'sports_fitness',
  'import_export',
  'other',
] as const;
export type IndustryId = (typeof INDUSTRY_IDS)[number];

// Business details collected from owners (ported from the first prototype's registration form).
export const BUSINESS_TYPES = ['sole_proprietorship', 'partnership', 'private_limited', 'public_limited', 'llp', 'other'] as const;
export const REGISTRATION_TYPES = ['registered_company', 'gst_registered', 'unregistered', 'other'] as const;
export const SECTORS = [
  'distributors',
  'stockists',
  'oem_vendors',
  'manufacturer',
  'wholesale',
  'branded_retail',
  'multibrand_retail',
  'large_format_retail',
  'ecommerce',
  'quick_commerce',
  'service_provider',
  'other',
] as const;
export const REVENUE_BANDS = ['pre_revenue', 'lt_10_lakh', '10_50_lakh', '50_lakh_1_cr', '1_10_cr', 'gt_10_cr'] as const;
export const TEAM_SIZES = ['solo', '2_10', '11_50', '51_200', '201_500', '500_plus'] as const;

// Professional details.
export const EMPLOYMENT_TYPES = ['independent', 'full_time', 'part_time', 'retired'] as const;
export const ENGAGEMENT_TYPES = ['one_time', 'ongoing', 'both'] as const;
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const QUALIFICATIONS = [
  'class_10',
  'class_12',
  'iti',
  'diploma',
  'ba',
  'bcom',
  'bsc',
  'bba',
  'bca',
  'be_btech',
  'barch',
  'mbbs',
  'bds',
  'bpharm',
  'llb',
  'bdes',
  'bhm',
  'ma',
  'mcom',
  'msc',
  'mba',
  'pgdm',
  'mca',
  'me_mtech',
  'llm',
  'md_ms',
  'mpharm',
  'ca',
  'cs',
  'cma',
  'cfa',
  'phd',
  'certification',
  'other',
] as const;
