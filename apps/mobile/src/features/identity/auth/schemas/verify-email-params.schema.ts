import { verifyEmailSchema } from '@aido/api/contracts/auth/v1';

export const verifyEmailParamsSchema = verifyEmailSchema.pick({ email: true });
