import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email(),
});
export type LoginBody = z.infer<typeof loginSchema>;

export const exchangeSchema = z.object({
  token: z.string().min(10),
});
export type ExchangeBody = z.infer<typeof exchangeSchema>;
