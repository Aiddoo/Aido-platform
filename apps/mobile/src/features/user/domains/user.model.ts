import { ACCOUNT_PROVIDERS, SUBSCRIPTION_STATUS, USER_ROLE } from '@aido/api';
import {
  PremiumAccessPolicy,
  PremiumAccessSchema,
} from '@src/features/subscription/domains/premium-access.model';
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
  createdAt: z.coerce.date(),
});
export type User = z.infer<typeof userSchema>;

export const updateProfileResultSchema = userSchema.pick({ name: true, profileImage: true });
export type UpdateProfileResult = z.infer<typeof updateProfileResultSchema>;

export type UserTier = 'ADMIN' | 'PREMIUM' | 'BASIC';

export function isPremiumUser(user: Pick<User, 'role' | 'subscriptionStatus'>): boolean {
  return user.role === 'ADMIN' || user.subscriptionStatus === 'ACTIVE';
}

export function hasCredential(user: Pick<User, 'providers'>): boolean {
  return user.providers.includes('CREDENTIAL');
}

export function getUserTier(user: Pick<User, 'role' | 'subscriptionStatus'>): UserTier {
  if (user.role === 'ADMIN') {
    return 'ADMIN';
  }
  if (user.subscriptionStatus === 'ACTIVE') {
    return 'PREMIUM';
  }
  return 'BASIC';
}

// 역할·구독 상태·프리미엄 기간 중 하나라도 바뀌면 서버가 주는 한도·사용량도 달라진다
export function hasEntitlementChanged(
  previous: Pick<User, 'role' | 'subscriptionStatus' | 'premiumAccess'>,
  next: Pick<User, 'role' | 'subscriptionStatus' | 'premiumAccess'>,
): boolean {
  return (
    previous.role !== next.role ||
    previous.subscriptionStatus !== next.subscriptionStatus ||
    PremiumAccessPolicy.hasChanged(previous.premiumAccess, next.premiumAccess)
  );
}

export const UserPolicy = {
  isPremiumUser,
  hasCredential,
  tier: getUserTier,
  hasEntitlementChanged,
} as const;
