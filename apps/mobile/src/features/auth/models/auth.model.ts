import { PASSWORD_RULES } from '@aido/validators';
import { z } from 'zod';

export const authTokensSchema = z.object({
  userId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  userName: z.string().nullable(),
  userProfileImage: z.string().nullable(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const preferenceSchema = z.object({
  pushEnabled: z.boolean(),
  nightPushEnabled: z.boolean(),
});
export type Preference = z.infer<typeof preferenceSchema>;

export const consentSchema = z.object({
  termsAgreedAt: z.coerce.date().nullable(),
  privacyAgreedAt: z.coerce.date().nullable(),
  agreedTermsVersion: z.string().nullable(),
  marketingAgreedAt: z.coerce.date().nullable(),
});
export type Consent = z.infer<typeof consentSchema>;

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

export function hasLetter(password: string) {
  return PASSWORD_RULES.HAS_LETTER.test(password);
}

export function hasNumber(password: string) {
  return PASSWORD_RULES.HAS_NUMBER.test(password);
}

export function hasMinLength(password: string, min: number) {
  return password.length >= min;
}

export const PasswordPolicy = {
  hasLetter,
  hasNumber,
  hasMinLength: (password: string) => hasMinLength(password, PASSWORD_RULES.MIN_LENGTH),
} as const;
