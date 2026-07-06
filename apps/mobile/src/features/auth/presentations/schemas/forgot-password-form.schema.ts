import { emailSchema, passwordSchema, VERIFICATION_CODE } from '@aido/validators';
import { t } from '@src/shared/i18n';
import { z } from 'zod';

export const forgotPasswordFormSchema = z
  .object({
    email: emailSchema,
    code: z
      .string()
      .length(VERIFICATION_CODE.LENGTH, {
        error: () => t('auth:forms.codeLength', { length: VERIFICATION_CODE.LENGTH }),
      })
      .regex(/^\d+$/, { error: () => t('auth:forms.codeDigitsOnly') }),
    newPassword: passwordSchema,
    newPasswordConfirm: z.string(),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    error: () => t('auth:forms.passwordMismatch'),
    path: ['newPasswordConfirm'],
  });

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordFormSchema>;
