import { verifyEmailSchema } from '@aido/api';

export const verifyEmailParamsSchema = verifyEmailSchema.pick({ email: true });
