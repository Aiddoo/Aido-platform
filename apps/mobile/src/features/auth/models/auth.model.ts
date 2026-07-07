import { PASSWORD_RULES } from '@aido/validators';
import { t } from '@src/shared/i18n';
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

export const preferenceSchema = z.object({
  pushEnabled: z.boolean(),
  nightPushEnabled: z.boolean(),
  morningReminderHour: z.number().int(),
  morningReminderMinute: z.number().int(),
  eveningReminderHour: z.number().int(),
  eveningReminderMinute: z.number().int(),
  timeFormat: z.enum(['TWELVE_HOUR', 'TWENTY_FOUR_HOUR']),
  weatherMorningEnabled: z.boolean(),
  weatherMorningHour: z.number().int(),
  weatherMorningMinute: z.number().int(),
  weatherEveningEnabled: z.boolean(),
  weatherEveningHour: z.number().int(),
  weatherEveningMinute: z.number().int(),
});
export type Preference = z.infer<typeof preferenceSchema>;

export function isWeatherEnabled(preference: Preference) {
  return preference.weatherMorningEnabled || preference.weatherEveningEnabled;
}

export const PreferencePolicy = {
  isPushDisabled(preference: Preference) {
    return !preference.pushEnabled;
  },

  isWeatherDisabled(preference: Preference) {
    return !preference.pushEnabled || !isWeatherEnabled(preference);
  },

  pushDisabledMessage(preference: Preference) {
    return !preference.pushEnabled ? t('auth:preference.enablePushFirst') : undefined;
  },

  weatherDisabledMessage(preference: Preference) {
    if (!preference.pushEnabled) return t('auth:preference.enablePushFirst');
    if (!isWeatherEnabled(preference)) return t('auth:preference.enableWeatherFirst');
    return undefined;
  },
} as const;

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

export const PasswordPolicy = {
  hasLetter,
  hasNumber,
  hasMinLength: (password: string) => hasMinLength(password, PASSWORD_RULES.MIN_LENGTH),
} as const;
