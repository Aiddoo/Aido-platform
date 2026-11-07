import { verifyEmailSchema } from '@aido/api';

export const verifyEmailScreenParamsSchema = verifyEmailSchema.pick({ email: true });

export const verificationCodeSchema = verifyEmailSchema.shape.code;
