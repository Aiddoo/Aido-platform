import { emailSchema, passwordSchema, VERIFICATION_CODE } from '@aido/validators';
import { z } from 'zod';

export const forgotPasswordFormSchema = z
  .object({
    email: emailSchema,
    code: z
      .string()
      .length(VERIFICATION_CODE.LENGTH, `인증 코드는 ${VERIFICATION_CODE.LENGTH}자리입니다`)
      .regex(/^\d+$/, '인증 코드는 숫자만 입력 가능합니다'),
    newPassword: passwordSchema,
    newPasswordConfirm: z.string(),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['newPasswordConfirm'],
  });

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordFormSchema>;
