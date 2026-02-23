import { emailSchema } from '@aido/validators';
import { z } from 'zod';

export const emailLoginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

export type EmailLoginFormData = z.infer<typeof emailLoginFormSchema>;
