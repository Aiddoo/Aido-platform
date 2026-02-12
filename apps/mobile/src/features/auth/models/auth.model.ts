import { z } from 'zod';

export const authTokensSchema = z.object({
  userId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  userName: z.string().nullable(),
  userProfileImage: z.string().nullable(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

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
  createdAt: z.coerce.date(),
});
export type User = z.infer<typeof userSchema>;

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

export type RegisterResult = { message: string; email: string };

export type ResendVerificationResult = {
  message: string;
  email: string;
  retryAfterSeconds?: number;
};

export type UpdateMarketingConsentResult = { marketingAgreedAt: Date | null };

// === OAuth Provider ===
/** 전체 계정 제공자 (DB/백엔드 기준) */
export const accountProviderSchema = z.enum(['CREDENTIAL', 'APPLE', 'GOOGLE', 'KAKAO', 'NAVER']);
export type AccountProvider = z.infer<typeof accountProviderSchema>;

/** 소셜 계정 제공자 (CREDENTIAL 제외) */
export const oauthProviderSchema = z.enum(['APPLE', 'GOOGLE', 'KAKAO', 'NAVER']);
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

/** 전체 로그인 수단 slug (UI/클라이언트 기준) */
export const authProviderSlugSchema = z.enum(['credential', 'apple', 'google', 'kakao', 'naver']);
export type AuthProviderSlug = z.infer<typeof authProviderSlugSchema>;

/** 소셜 로그인 수단 slug (credential 제외) */
export const oauthProviderSlugSchema = z.enum(['apple', 'google', 'kakao', 'naver']);
export type OAuthProviderSlug = z.infer<typeof oauthProviderSlugSchema>;

/**
 * 브라우저 start 엔드포인트를 사용하는 provider.
 * Apple은 Web start 플로우를 사용하지 않고 idToken 기반 callback/link API를 사용한다.
 */
export type OAuthStartProvider = Exclude<OAuthProviderSlug, 'apple'>;
export type OAuthStartMode = 'login' | 'link';

export const linkedAccountSchema = z.object({
  provider: oauthProviderSchema,
  linked: z.boolean(),
  providerAccountId: z.string().nullable(),
  linkedAt: z.date().nullable(),
});
export type LinkedAccount = z.infer<typeof linkedAccountSchema>;

export const AuthPolicy = {
  isSubscriptionActive: (status: SubscriptionStatus): boolean => {
    return status === 'ACTIVE';
  },
  canUnlinkAccount: (linkedCount: number): boolean => {
    return linkedCount > 1;
  },
} as const;
