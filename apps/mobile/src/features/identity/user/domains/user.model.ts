import { ACCOUNT_PROVIDERS, SUBSCRIPTION_STATUS, USER_ROLE } from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { userSummarySchema } from '@src/shared/domains/user-summary.model';
import { z } from 'zod';

import { PremiumAccessPolicy, premiumAccessSchema } from './premium-access.model';

export const userSchema = userSummarySchema.extend({
  email: z.string(),
  role: z.enum(USER_ROLE),
  subscriptionStatus: z.enum(SUBSCRIPTION_STATUS),
  subscriptionExpiresAt: instantSchema.nullable(),
  providers: z.array(z.enum(ACCOUNT_PROVIDERS)),
  premiumAccess: premiumAccessSchema,
  /** 서버가 만료·유예까지 따진 구독·보상 효력(ADMIN 미반영). 앱의 결제 사용자 판별은 UserPolicy.hasPremiumAccess 하나다 */
  isPremium: z.boolean(),
  createdAt: instantSchema,
});
export type User = z.infer<typeof userSchema>;

/** profileImage null은 사진을 지운 상태다 */
const updateProfileResultSchema = userSummarySchema.pick({ name: true, profileImage: true });
export type UpdateProfileResult = z.infer<typeof updateProfileResultSchema>;

function hasCredential(user: User) {
  return user.providers.includes('CREDENTIAL');
}

function isAdmin(user: User) {
  return user.role === USER_ROLE.ADMIN;
}

/** 서버의 isPremium은 ADMIN을 반영하지 않는다. 앱의 "결제 사용자" 판별은 여기 하나다 */
function hasPremiumAccess(user: User) {
  return isAdmin(user) || user.isPremium;
}

/** 역할·프리미엄 효력·기간이 바뀌면 서버가 주는 한도·사용량도 달라진다 */
function hasEntitlementChanged(previous: User, next: User) {
  return (
    previous.role !== next.role ||
    previous.isPremium !== next.isPremium ||
    PremiumAccessPolicy.hasChanged(previous.premiumAccess, next.premiumAccess)
  );
}

export const UserPolicy = {
  hasCredential,
  isAdmin,
  hasPremiumAccess,
  hasEntitlementChanged,
} as const;
