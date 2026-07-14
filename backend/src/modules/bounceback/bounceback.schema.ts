import { z } from 'zod';

export const bouncebackSimulateSchema = z.object({
  incomingNumber: z.string().trim().optional(),
  industry: z.string().trim().optional(),
  region: z.string().trim().optional(),
  businessName: z.string().trim().optional(),
});

export type BouncebackSimulateBody = z.infer<typeof bouncebackSimulateSchema>;
