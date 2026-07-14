import { z } from 'zod';

export const pushSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1, 'select at least one lead').max(100),
});
export type PushBody = z.infer<typeof pushSchema>;
