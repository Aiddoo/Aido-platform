import { refreshTokensSchema } from '@aido/api';
import { z } from 'zod';

export const pendingRevocationSchema = z.object({
  refreshToken: z.string(),
  expiresAt: z.number(),
});

export type PendingRevocation = z.infer<typeof pendingRevocationSchema>;

export const refreshEnvelopeSchema = z.object({ data: refreshTokensSchema });
