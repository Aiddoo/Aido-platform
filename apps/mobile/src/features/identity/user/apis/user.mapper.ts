import type { UpdateProfileResponse } from '@aido/api';
import type { SubscriptionPlanType } from '@aido/api/vocabulary';
import { toInstant, toNullableInstant } from '@src/shared/date/instant';

import type { PremiumPlanType } from '../domains/premium-access.model';
import { type UpdateProfileResult, type User } from '../domains/user.model';
import { type CurrentUserResponse } from '../schemas/user-response.schema';

const PREMIUM_PLAN_TYPES = {
  ANNUAL: 'annual',
  MONTHLY: 'monthly',
} as const satisfies Record<SubscriptionPlanType, PremiumPlanType>;

export function toUser(dto: CurrentUserResponse): User {
  return {
    id: dto.userId,
    email: dto.email,
    name: dto.name,
    profileImage: dto.profileImage,
    userTag: dto.userTag,
    role: dto.role,
    subscriptionStatus: dto.subscriptionStatus,
    subscriptionExpiresAt: toNullableInstant(dto.subscriptionExpiresAt),
    providers: dto.providers,
    premiumAccess: {
      source: dto.premiumSource,
      endsAt: toNullableInstant(dto.premiumEndsAt),
      periodEndsAt: toNullableInstant(dto.premiumPeriodEndsAt),
      willRenew: dto.willRenew,
      isTrial: dto.premiumIsTrial,
      bankedDays: dto.bankedPremiumDays,
      grantEndedAt: toNullableInstant(dto.premiumGrantEndedAt),
      // 모르는 상품은 요금제 없이 "구독"으로 보인다
      planType: dto.premiumPlanType == null ? null : PREMIUM_PLAN_TYPES[dto.premiumPlanType],
    },
    isPremium: dto.isPremium,
    createdAt: toInstant(dto.createdAt),
  };
}

export function toUpdateProfileResult(dto: UpdateProfileResponse): UpdateProfileResult {
  return { name: dto.name, profileImage: dto.profileImage };
}
