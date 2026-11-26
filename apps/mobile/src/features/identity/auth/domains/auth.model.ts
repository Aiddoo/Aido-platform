import { VERIFICATION_CODE } from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

const VERIFICATION_CODE_PATTERN = new RegExp(`^\\d{${VERIFICATION_CODE.LENGTH}}$`, 'u');

/** 서버 계약과 같이 숫자만 정해진 자리 수다. 아니면 보내지 않고 칸을 오류로 보인다 */
export function isVerificationCode(code: string): boolean {
  return VERIFICATION_CODE_PATTERN.test(code);
}

const registerResultSchema = z.object({
  /** 인증 메일을 발송 큐에 담았는지. false면 가입은 됐고 재발송으로 다시 받는다 */
  isEmailSent: z.boolean(),
});
export type RegisterResult = z.infer<typeof registerResultSchema>;

const resendVerificationResultSchema = z.object({
  /** 다시 보낼 수 있을 때까지 남은 초. 서버가 싣지 않으면 null이고 화면이 기본 대기 시간을 쓴다 */
  retryAfterSeconds: z.number().nullable(),
});
export type ResendVerificationResult = z.infer<typeof resendVerificationResultSchema>;

const deleteAccountResultSchema = z.object({
  message: z.string(),
  deletedAt: instantSchema,
  gracePeriodDays: z.number(),
});
export type DeleteAccountResult = z.infer<typeof deleteAccountResultSchema>;

const forgotPasswordResultSchema = z.object({
  message: z.string(),
});
export type ForgotPasswordResult = z.infer<typeof forgotPasswordResultSchema>;

const resetPasswordResultSchema = z.object({
  message: z.string(),
});
export type ResetPasswordResult = z.infer<typeof resetPasswordResultSchema>;

const changePasswordResultSchema = z.object({
  message: z.string(),
});
export type ChangePasswordResult = z.infer<typeof changePasswordResultSchema>;
