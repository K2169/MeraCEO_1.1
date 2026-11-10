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
} from '@meraceo/shared';

import { t } from '@/i18n';

// Labels come from i18n keys (industry.*, expertise.*, fee.*, format.*, opt.<group>.*). Values are shared contracts.
const labelled = <T extends string>(ids: readonly T[], key: (id: T) => string) => ids.map((id) => ({ value: id, label: t(key(id)) }));

export const industryOptions = () => labelled(INDUSTRY_IDS, (id) => `industry.${id}`);
// Expertise choices for chips, with translated labels.
export const expertiseOptions = () => labelled(EXPERTISE_IDS, (id) => `expertise.${id}`);
// Fee and budget band choices for chips, with translated labels.
export const feeOptions = () => labelled(FEE_BANDS, (id) => `fee.${id}`);
// Consultation format choices for chips, with translated labels.
export const formatOptions = () => labelled(FORMATS, (id) => `format.${id}`);
export const businessTypeOptions = () => labelled(BUSINESS_TYPES, (id) => `opt.businessType.${id}`);
export const registrationOptions = () => labelled(REGISTRATION_TYPES, (id) => `opt.registration.${id}`);
export const sectorOptions = () => labelled(SECTORS, (id) => `opt.sector.${id}`);
export const revenueOptions = () => labelled(REVENUE_BANDS, (id) => `opt.revenue.${id}`);
export const teamSizeOptions = () => labelled(TEAM_SIZES, (id) => `opt.teamSize.${id}`);
export const employmentOptions = () => labelled(EMPLOYMENT_TYPES, (id) => `opt.employment.${id}`);
export const engagementOptions = () => labelled(ENGAGEMENT_TYPES, (id) => `opt.engagement.${id}`);
export const dayOptions = () => labelled(DAYS, (id) => `opt.day.${id}`);
export const qualificationOptions = () => labelled(QUALIFICATIONS, (id) => `opt.qualification.${id}`);
