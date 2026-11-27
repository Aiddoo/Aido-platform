import { ACCOUNT_PROVIDERS, SUBSCRIPTION_STATUS, USER_ROLE } from '@aido/api/vocabulary';
import { type Instant, instantSchema } from '@src/shared/date/instant';
import { isWithinInviteRedeemWindow } from '@src/shared/domains/invite-redeem-window.model';
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
  /** 서버가 만료·유예까지 따진 구독·보상 효력(ADMIN 미반영). 화면의 프리미엄 판별은 EntitlementPolicy.hasFullAccess다 */
  isPremium: z.boolean(),
  createdAt: instantSchema,
});
export type User = z.infer<typeof userSchema>;

/** profileImage null은 사진을 지운 상태다 */
const updateProfileResultSchema = userSummarySchema.pick({ name: true, profileImage: true });
export type UpdateProfileResult = z.infer<typeof updateProfileResultSchema>;

export const UserPolicy = {
  hasCredential(user: User): boolean {
    return user.providers.includes('CREDENTIAL');
  },

  isAdmin(user: User): boolean {
    return user.role === USER_ROLE.ADMIN;
  },

  /** 한 번도 구독하지 않은 계정. 만료·해지한 계정은 FREE로 돌아가지 않는다 */
  isNeverSubscribed(user: User): boolean {
    return user.subscriptionStatus === 'FREE';
  },

  /** 가입한 지 며칠 안 된 계정만 초대 보상을 기대할 수 있다. 최종 판정은 서버다 */
  isInviteRewardExpected(user: User, now: Instant): boolean {
    return isWithinInviteRedeemWindow(user.createdAt, now);
  },

  /** 역할·프리미엄 효력·기간이 바뀌면 서버가 주는 한도·사용량도 달라진다 */
  hasEntitlementChanged(previous: User, next: User): boolean {
    return (
      previous.role !== next.role ||
      previous.isPremium !== next.isPremium ||
      PremiumAccessPolicy.hasChanged(previous.premiumAccess, next.premiumAccess)
    );
  },
};
