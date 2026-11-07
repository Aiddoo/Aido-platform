import { currentUserSchema, type UpdateProfileInput } from '@aido/api';
import { ACCOUNT_PROVIDERS, SUBSCRIPTION_STATUS, USER_ROLE } from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

import { premiumAccessSchema } from './premium-access.schema';

/** 계약은 구버전 서버 때문에 선택 필드지만, 지금 서버는 프리미엄 출처·기간·효력을 항상 보낸다. 기능 권한은 GET /v1/entitlements에서 읽는다 */
export const currentUserResponseSchema = currentUserSchema.required({
  premiumSource: true,
  premiumEndsAt: true,
  premiumPeriodEndsAt: true,
  willRenew: true,
  bankedPremiumDays: true,
  premiumGrantEndedAt: true,
  isPremium: true,
});
export type CurrentUserResponse = z.output<typeof currentUserResponseSchema>;

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  userTag: z.string(),
  role: z.enum([USER_ROLE.USER, USER_ROLE.ADMIN]),
  subscriptionStatus: z.enum(SUBSCRIPTION_STATUS),
  subscriptionExpiresAt: instantSchema.nullable(),
  providers: z.array(z.enum(ACCOUNT_PROVIDERS)),
  premiumAccess: premiumAccessSchema,
  /** 서버가 만료·유예까지 따진 구독·보상 효력(ADMIN 미반영). 앱의 결제 사용자 판별은 UserPolicy.hasPremiumAccess 하나다 */
  isPremium: z.boolean(),
  createdAt: instantSchema,
});
export type User = z.infer<typeof userSchema>;

/** 이름이나 프로필 사진 중 바꿀 칸만 담는다. profileImage null은 사진 지우기다 */
export type ProfileChange = UpdateProfileInput;

const updateProfileResultSchema = userSchema.pick({ name: true, profileImage: true });
export type UpdateProfileResult = z.infer<typeof updateProfileResultSchema>;
