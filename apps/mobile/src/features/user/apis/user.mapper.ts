import {
  currentUserSchema,
  PREMIUM_FEATURE_KEYS,
  type PremiumEntitlements as PremiumEntitlementsDto,
  type UpdateProfileResponse,
} from '@aido/api';
import type { PremiumEntitlements } from '@src/features/subscription/domains/premium-entitlement.model';
import { mapValues, pick } from 'es-toolkit';
import type { z } from 'zod';

import type { UpdateProfileResult, User } from '../domains/user.model';

// 계약은 구버전 서버 때문에 선택 필드지만, 지금 서버는 프리미엄 출처·기간·효력·권한을 항상 보낸다
export const CurrentUserSchema = currentUserSchema.required({
  premiumSource: true,
  premiumEndsAt: true,
  premiumPeriodEndsAt: true,
  willRenew: true,
  bankedPremiumDays: true,
  premiumGrantEndedAt: true,
  isPremium: true,
  entitlements: true,
});
export type CurrentUserResponse = z.output<typeof CurrentUserSchema>;

const toNullableDate = (value: string | null) => (value == null ? null : new Date(value));

// 새 서버가 더한 모르는 기능 키는 버리고, 초기화 시각만 Date로 바꾼다
const toPremiumEntitlements = (dto: PremiumEntitlementsDto): PremiumEntitlements =>
  mapValues(pick(dto, PREMIUM_FEATURE_KEYS), ({ resetsAt, ...entitlement }) => ({
    ...entitlement,
    resetsAt: resetsAt == null ? undefined : new Date(resetsAt),
  }));

export const toUser = (dto: CurrentUserResponse): User => ({
  id: dto.userId,
  email: dto.email,
  name: dto.name,
  profileImage: dto.profileImage,
  userTag: dto.userTag,
  role: dto.role,
  subscriptionStatus: dto.subscriptionStatus,
  subscriptionExpiresAt: dto.subscriptionExpiresAt ? new Date(dto.subscriptionExpiresAt) : null,
  providers: dto.providers,
  premiumAccess: {
    source: dto.premiumSource,
    endsAt: toNullableDate(dto.premiumEndsAt),
    periodEndsAt: toNullableDate(dto.premiumPeriodEndsAt),
    willRenew: dto.willRenew,
    bankedDays: dto.bankedPremiumDays,
    grantEndedAt: toNullableDate(dto.premiumGrantEndedAt),
  },
  isPremium: dto.isPremium,
  entitlements: toPremiumEntitlements(dto.entitlements),
  createdAt: new Date(dto.createdAt),
});

export const toUpdateProfileResult = (dto: UpdateProfileResponse): UpdateProfileResult => ({
  name: dto.name,
  profileImage: dto.profileImage,
});
