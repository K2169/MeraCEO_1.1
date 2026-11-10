import { z } from 'zod';

import { EXPERTISE_IDS, FEE_BANDS, FORMATS, INDUSTRY_IDS } from '../enums';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

// A business need an owner posts. Same rules for the first need (from onboarding) and later ones.
export const createNeedSchema = z.object({
  title: text(5, 120),
  challenge: text(20, 1000),
  goals: text(10, 600).optional(),
  expertise: z.array(z.enum(EXPERTISE_IDS)).min(1).max(5),
  industry: z.enum(INDUSTRY_IDS),
  budgetBand: z.enum(FEE_BANDS),
  format: z.enum(FORMATS).optional(),
});
export type CreateNeedInput = z.infer<typeof createNeedSchema>;
