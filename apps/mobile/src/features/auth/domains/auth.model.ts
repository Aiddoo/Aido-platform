import { aiDataSharingDecisionSchema, PASSWORD_RULES } from '@aido/api';
import { z } from 'zod';

export const authTokensSchema = z.object({
  userId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  userName: z.string().nullable(),
  userProfileImage: z.string().nullable(),
  accountRestored: z.boolean().optional().default(false),
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
});
export type Consent = z.infer<typeof consentSchema>;

export const ConsentPolicy = {
  /** 지금 안내 버전에 동의했을 때만 AI에 내용을 보낸다. 안내가 바뀌면 서버가 UNDECIDED로 돌려준다 */
  hasAgreedToAiDataSharing: (consent: Consent): boolean =>
    consent.aiDataSharingDecision === 'AGREED',
} as const;

export const registerResultSchema = z.object({
  message: z.string(),
  email: z.string(),
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
