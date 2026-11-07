import { z } from 'zod';

export type {
  ChangePasswordInput,
  DeleteAccountInput,
  ExchangeCodeInput,
  ForgotPasswordInput,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '@aido/api';

const authTokensSchema = z.object({
  userId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  userName: z.string().nullable(),
  userProfileImage: z.string().nullable(),
  accountRestored: z.boolean().optional().default(false),
  isNewUser: z.boolean().optional().default(false),
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
  retryAfterSeconds: z.number().optional(),
});
export type ResendVerificationResult = z.infer<typeof resendVerificationResultSchema>;

const deleteAccountResultSchema = z.object({
  message: z.string(),
  deletedAt: z.coerce.date(),
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
