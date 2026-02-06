import { z } from 'zod';

// === Auth Tokens ===
export const authTokensSchema = z.object({
  userId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  userName: z.string().nullable(),
  userProfileImage: z.string().nullable(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

// === User ===
export const subscriptionStatusSchema = z.enum(['FREE', 'ACTIVE', 'EXPIRED', 'CANCELLED']);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  userTag: z.string(),
  subscriptionStatus: subscriptionStatusSchema,
  isSubscribed: z.boolean(),
  createdAt: z.date(),
});
export type User = z.infer<typeof userSchema>;

// === Preference ===
export const preferenceSchema = z.object({
  pushEnabled: z.boolean(),
  nightPushEnabled: z.boolean(),
});
export type Preference = z.infer<typeof preferenceSchema>;

// === Consent ===
export const consentSchema = z.object({
  termsAgreedAt: z.date().nullable(),
  privacyAgreedAt: z.date().nullable(),
  agreedTermsVersion: z.string().nullable(),
  marketingAgreedAt: z.date().nullable(),
});
export type Consent = z.infer<typeof consentSchema>;

// === Register ===
export const registerResultSchema = z.object({
  message: z.string(),
  email: z.string(),
});
export type RegisterResult = z.infer<typeof registerResultSchema>;

// === Resend Verification ===
export const resendVerificationResultSchema = z.object({
  message: z.string(),
  email: z.string(),
  retryAfterSeconds: z.number().optional(),
});
export type ResendVerificationResult = z.infer<typeof resendVerificationResultSchema>;

// === Update Marketing Consent ===
export const updateMarketingConsentResultSchema = z.object({
  marketingAgreedAt: z.date().nullable(),
});
export type UpdateMarketingConsentResult = z.infer<typeof updateMarketingConsentResultSchema>;

// === Policy ===
export const AuthPolicy = {
  isSubscriptionActive: (status: SubscriptionStatus): boolean => status === 'ACTIVE',
} as const;
