import { z } from 'zod';

// Rules for sending a consultation request.
export const createRequestSchema = z.object({
  needId: z.string().min(1),
  professionalId: z.string().min(1),
  // Optional short note shown to the professional with the request.
  note: z.string().trim().max(500).optional(),
});
export type CreateRequestInput = z.infer<typeof createRequestSchema>;
