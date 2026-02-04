import { emailSchema, passwordSchema } from '@aido/validators';
import { z } from 'zod';

export const signUpFormSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
    name: z
      .string()
      .min(1, '닉네임을 입력해주세요')
      .max(100, '이름은 100자 이내여야 합니다')
      .trim(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['passwordConfirm'],
  });

export type SignUpFormData = z.infer<typeof signUpFormSchema>;
