import { resetPasswordSchema, verifyEmailSchema } from '@aido/api';
import type { z } from 'zod';

export const forgotPasswordFormSchema = resetPasswordSchema.safeExtend({
  code: verifyEmailSchema.shape.code,
});

export type ForgotPasswordFormValues = z.input<typeof forgotPasswordFormSchema>;
