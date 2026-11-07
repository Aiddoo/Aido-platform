import { verifyEmailSchema } from '@aido/api';

export const verifyEmailParamsSchema = verifyEmailSchema.pick({ email: true });

export const verificationCodeSchema = verifyEmailSchema.shape.code;
