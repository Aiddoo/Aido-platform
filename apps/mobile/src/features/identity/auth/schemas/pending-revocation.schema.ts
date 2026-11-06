import { z } from 'zod';

export const pendingRevocationSchema = z.object({
  refreshToken: z.string(),
  expiresAt: z.number(),
});

export type PendingRevocation = z.infer<typeof pendingRevocationSchema>;
