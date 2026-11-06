import { ACCOUNT_PROVIDERS, SUBSCRIPTION_STATUS, USER_ROLE } from '@aido/api/vocabulary';
import {
  PremiumAccessPolicy,
  PremiumAccessSchema,
} from '@src/features/identity/user/domains/premium-access.model';
import { z } from 'zod';

const accountProviderSchema = z.enum(ACCOUNT_PROVIDERS);

const subscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUS);
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
  /** 서버가 만료·유예까지 따진 구독·보상 효력(ADMIN 미반영). 기능 권한은 EntitlementPolicy로 판단한다 */
  isPremium: z.boolean(),
  createdAt: z.coerce.date(),
});
export type User = z.infer<typeof userSchema>;

const updateProfileResultSchema = userSchema.pick({ name: true, profileImage: true });
export type UpdateProfileResult = z.infer<typeof updateProfileResultSchema>;

function hasCredential(user: Pick<User, 'providers'>): boolean {
  return user.providers.includes('CREDENTIAL');
}

// 역할·프리미엄 효력·기간이 바뀌면 서버가 주는 한도·사용량도 달라진다
function hasEntitlementChanged(
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
  hasCredential,
  hasEntitlementChanged,
} as const;
