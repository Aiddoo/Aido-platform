import { authTokensSchema as authTokensResponseSchema, registerResponseSchema } from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
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
  accountRestored: z.boolean(),
  /** 소셜 로그인 응답에만 실린다. 이메일 로그인과 인증은 싣지 않아 기존 계정으로 본다 */
  isNewUser: z.boolean().optional().default(false),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

/** 지금 서버는 복구 여부를 항상 싣는다. 계약의 선택 칸을 앱에서는 필수로 읽는다 */
export const authTokensEnvelopeSchema = authTokensResponseSchema.required({
  accountRestored: true,
});
export type AuthTokensEnvelope = z.infer<typeof authTokensEnvelopeSchema>;

/** 지금 서버는 인증 메일을 담았는지를 항상 싣는다. 계약의 선택 칸을 앱에서는 필수로 읽는다 */
export const registerEnvelopeSchema = registerResponseSchema.required({ emailSent: true });
export type RegisterEnvelope = z.infer<typeof registerEnvelopeSchema>;

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
