import { emailSchema, passwordSchema } from '@aido/validators';
import { t } from '@src/shared/i18n';
import { z } from 'zod';

export const signUpFormSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
    name: z
      .string()
      .min(1, { error: () => t('auth:forms.nicknameRequired') })
      .max(20, { error: () => t('auth:forms.nameMaxLength', { max: 20 }) })
      .trim(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    error: () => t('auth:forms.passwordMismatch'),
    path: ['passwordConfirm'],
  });

export type SignUpFormData = z.infer<typeof signUpFormSchema>;
