import { resetPasswordSchema, verifyEmailSchema } from '@aido/api';
import type { z } from 'zod';

/** 비밀번호 재설정 폼. 인증 코드는 이메일 인증과 같은 숫자 규칙으로 좁힌다. */
export const forgotPasswordFormSchema = resetPasswordSchema.safeExtend({
  code: verifyEmailSchema.shape.code,
});

export type ForgotPasswordFormInput = z.input<typeof forgotPasswordFormSchema>;
