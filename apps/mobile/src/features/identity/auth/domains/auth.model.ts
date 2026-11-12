import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

const authTokensSchema = z.object({
  userId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  userName: z.string().nullable(),
  userProfileImage: z.string().nullable(),
  accountRestored: z.boolean(),
  /** 소셜 로그인 응답에만 실린다. 이메일 로그인과 인증은 싣지 않아 mapper가 기존 계정(false)으로 읽는다 */
  isNewUser: z.boolean(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

const registerResultSchema = z.object({
  message: z.string(),
  email: z.string(),
  /** 인증 메일을 발송 큐에 담았는지. false면 가입은 됐고 재발송으로 다시 받는다 */
  isEmailSent: z.boolean(),
});
export type RegisterResult = z.infer<typeof registerResultSchema>;

const resendVerificationResultSchema = z.object({
  message: z.string(),
  email: z.string(),
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
