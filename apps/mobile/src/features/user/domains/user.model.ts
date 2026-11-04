import {
  ACCOUNT_PROVIDERS,
  SUBSCRIPTION_STATUS,
  USER_ROLE,
  type PremiumLimitFeatureKey,
} from '@aido/api';
import {
  PremiumAccessPolicy,
  PremiumAccessSchema,
} from '@src/features/subscription/domains/premium-access.model';
import {
  PremiumEntitlementPolicy,
  PremiumEntitlementsSchema,
} from '@src/features/subscription/domains/premium-entitlement.model';
import { z } from 'zod';

const accountProviderSchema = z.enum(ACCOUNT_PROVIDERS);

export const subscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUS);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

const userRoleSchema = z.enum([USER_ROLE.USER, USER_ROLE.ADMIN]);

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  userTag: z.string(),
  role: userRoleSchema,
  subscriptionStatus: subscriptionStatusSchema,
  subscriptionExpiresAt: z.coerce.date().nullable(),
  providers: z.array(accountProviderSchema),
  premiumAccess: PremiumAccessSchema,
  /** 서버가 만료·유예까지 따진 구독·보상 효력(ADMIN 미반영) */
  isPremium: z.boolean(),
  /** 기능별 현재 권한 */
  entitlements: PremiumEntitlementsSchema,
  createdAt: z.coerce.date(),
});
export type User = z.infer<typeof userSchema>;

export const updateProfileResultSchema = userSchema.pick({ name: true, profileImage: true });
export type UpdateProfileResult = z.infer<typeof updateProfileResultSchema>;

export type UserTier = 'ADMIN' | 'PREMIUM' | 'BASIC';

type PremiumDecisionUser = Pick<User, 'role' | 'isPremium' | 'premiumAccess'>;

/**
 * 서버의 유효 프리미엄 판단(isPremium)을 따른다.
 * 구독 상태가 ACTIVE여도 만료돼 효력이 없으면 프리미엄이 아니다
 */
export function isPremiumUser(user: PremiumDecisionUser): boolean {
  return user.role === USER_ROLE.ADMIN || user.isPremium;
}

/** 기능의 지금 한도. null은 무제한이다 */
export function getFeatureLimit(
  user: Pick<User, 'entitlements'>,
  feature: PremiumLimitFeatureKey,
): number | null {
  return PremiumEntitlementPolicy.limit(user, feature);
}

/** 무료로 쓸 수 있는 한도. 혜택 안내 문구에 쓴다 */
export function getFreeFeatureLimit(
  user: PremiumDecisionUser & Pick<User, 'entitlements'>,
  feature: PremiumLimitFeatureKey,
): number {
  return PremiumEntitlementPolicy.freeLimit(
    { entitlements: user.entitlements, isPremium: isPremiumUser(user) },
    feature,
  );
}

export function hasCredential(user: Pick<User, 'providers'>): boolean {
  return user.providers.includes('CREDENTIAL');
}

export function getUserTier(user: PremiumDecisionUser): UserTier {
  if (user.role === USER_ROLE.ADMIN) {
    return 'ADMIN';
  }
  if (isPremiumUser(user)) {
    return 'PREMIUM';
  }
  return 'BASIC';
}

// 역할·프리미엄 효력·기간이 바뀌면 서버가 주는 한도·사용량도 달라진다
export function hasEntitlementChanged(
  previous: Pick<User, 'role' | 'isPremium' | 'premiumAccess'>,
  next: Pick<User, 'role' | 'isPremium' | 'premiumAccess'>,
): boolean {
  return (
    previous.role !== next.role ||
    previous.isPremium !== next.isPremium ||
    PremiumAccessPolicy.hasChanged(previous.premiumAccess, next.premiumAccess)
  );
}

export const UserPolicy = {
  isPremiumUser,
  hasCredential,
  tier: getUserTier,
  featureLimit: getFeatureLimit,
  freeFeatureLimit: getFreeFeatureLimit,
  hasEntitlementChanged,
} as const;
