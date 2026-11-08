import { authTokensSchema, registerResponseSchema } from '@aido/api';
import type { z } from 'zod';

export const authTokensEnvelopeSchema = authTokensSchema.required({
  accountRestored: true,
});
export type AuthTokensEnvelope = z.infer<typeof authTokensEnvelopeSchema>;

export const registerEnvelopeSchema = registerResponseSchema.required({ emailSent: true });
export type RegisterEnvelope = z.infer<typeof registerEnvelopeSchema>;
