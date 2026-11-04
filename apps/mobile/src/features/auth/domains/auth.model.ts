import { aiDataSharingDecisionSchema, PASSWORD_RULES } from '@aido/api';
import { AI_DATA_SHARING_CONSENT } from '@aido/api/vocabulary';
import { z } from 'zod';

export const authTokensSchema = z.object({
  userId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  userName: z.string().nullable(),
  userProfileImage: z.string().nullable(),
  accountRestored: z.boolean().optional().default(false),
  isNewUser: z.boolean().optional().default(false),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const consentSchema = z.object({
  termsAgreedAt: z.coerce.date().nullable(),
  privacyAgreedAt: z.coerce.date().nullable(),
  agreedTermsVersion: z.string().nullable(),
  marketingAgreedAt: z.coerce.date().nullable(),
  marketingPushAgreedAt: z.coerce.date().nullable(),
  aiDataSharingDecision: aiDataSharingDecisionSchema,
  aiDataSharingAgreedAt: z.coerce.date().nullable(),
  /** 마지막으로 답한 안내 버전. 답한 적이 없거나 서버가 주지 않으면 null */
  aiDataSharingConsentVersion: z.string().nullable(),
});
export type Consent = z.infer<typeof consentSchema>;

export const ConsentPolicy = {
  /** 이전 안내 버전 동의도 AGREED다. 서버가 그 버전의 처리 업체만 쓰므로 기능은 그대로 동작한다 */
  hasAgreedToAiDataSharing: (consent: Consent): boolean =>
    consent.aiDataSharingDecision === 'AGREED',
  /** 이전 안내에 동의한 사람에게 바뀐 안내를 보여 줘야 하는지. 버전을 모르면 묻지 않는다 */
  shouldShowAiConsentRenewal: (consent: Consent): boolean =>
    consent.aiDataSharingDecision === 'AGREED' &&
    consent.aiDataSharingConsentVersion != null &&
    consent.aiDataSharingConsentVersion !== AI_DATA_SHARING_CONSENT.VERSION,
} as const;

export const registerResultSchema = z.object({
  message: z.string(),
  email: z.string(),
  /** 인증 메일을 발송 큐에 담았는지. false면 가입은 됐고 재발송으로 다시 받는다 */
  isEmailSent: z.boolean(),
});
export type RegisterResult = z.infer<typeof registerResultSchema>;

export const resendVerificationResultSchema = z.object({
  message: z.string(),
  email: z.string(),
  retryAfterSeconds: z.number().optional(),
});
export type ResendVerificationResult = z.infer<typeof resendVerificationResultSchema>;

export const updateMarketingConsentResultSchema = z.object({
  marketingAgreedAt: z.coerce.date().nullable(),
});
export type UpdateMarketingConsentResult = z.infer<typeof updateMarketingConsentResultSchema>;

export const updateMarketingPushConsentResultSchema = z.object({
  marketingPushAgreedAt: z.coerce.date().nullable(),
});
export type UpdateMarketingPushConsentResult = z.infer<
  typeof updateMarketingPushConsentResultSchema
>;

export const updateAiDataSharingConsentResultSchema = consentSchema.pick({
  aiDataSharingDecision: true,
  aiDataSharingAgreedAt: true,
  aiDataSharingConsentVersion: true,
});
export type UpdateAiDataSharingConsentResult = z.infer<
  typeof updateAiDataSharingConsentResultSchema
>;

export const deleteAccountResultSchema = z.object({
  message: z.string(),
  deletedAt: z.coerce.date(),
  gracePeriodDays: z.number(),
});
export type DeleteAccountResult = z.infer<typeof deleteAccountResultSchema>;

export const forgotPasswordResultSchema = z.object({
  message: z.string(),
});
export type ForgotPasswordResult = z.infer<typeof forgotPasswordResultSchema>;

export const resetPasswordResultSchema = z.object({
  message: z.string(),
});
export type ResetPasswordResult = z.infer<typeof resetPasswordResultSchema>;

export const changePasswordResultSchema = z.object({
  message: z.string(),
});
export type ChangePasswordResult = z.infer<typeof changePasswordResultSchema>;

export function hasLetter(password: string) {
  return PASSWORD_RULES.HAS_LETTER.test(password);
}

export function hasNumber(password: string) {
  return PASSWORD_RULES.HAS_NUMBER.test(password);
}

export function hasMinLength(password: string, min: number) {
  return password.length >= min;
}

export function hasMinimumPasswordLength(password: string) {
  return hasMinLength(password, PASSWORD_RULES.MIN_LENGTH);
}

export const PasswordPolicy = {
  hasLetter,
  hasNumber,
  hasMinLength: hasMinimumPasswordLength,
} as const;
