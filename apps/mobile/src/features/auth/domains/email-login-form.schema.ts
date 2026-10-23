import { emailSchema } from '@aido/api';
import { t } from '@src/shared/i18n';
import { z } from 'zod';

export const emailLoginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: () => t('auth:forms.passwordRequired') }),
});

export type EmailLoginFormData = z.infer<typeof emailLoginFormSchema>;
