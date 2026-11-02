import {
  type CurrentUser,
  PREMIUM_FEATURE_KEYS,
  type PremiumEntitlements as PremiumEntitlementsDto,
  type UpdateProfileResponse,
} from '@aido/api';
import type { PremiumEntitlements } from '@src/features/subscription/domains/premium-entitlement.model';
import { mapValues, pick } from 'es-toolkit';

import type { UpdateProfileResult, User } from '../domains/user.model';

const toNullableDate = (value: string | null | undefined) =>
  value == null ? null : new Date(value);

// 새 서버가 더한 모르는 기능 키는 버리고, 초기화 시각만 Date로 바꾼다
const toPremiumEntitlements = (dto: PremiumEntitlementsDto): PremiumEntitlements =>
  mapValues(pick(dto, PREMIUM_FEATURE_KEYS), ({ resetsAt, ...entitlement }) => ({
    ...entitlement,
    resetsAt: resetsAt == null ? undefined : new Date(resetsAt),
  }));

export const toUser = (dto: CurrentUser): User => ({
  id: dto.userId,
  email: dto.email,
  name: dto.name,
  profileImage: dto.profileImage,
  userTag: dto.userTag,
  role: dto.role,
  subscriptionStatus: dto.subscriptionStatus,
  subscriptionExpiresAt: dto.subscriptionExpiresAt ? new Date(dto.subscriptionExpiresAt) : null,
  providers: dto.providers,
  // 구버전 서버는 이 필드들을 보내지 않으므로 '보상 기간 없음'으로 본다
  premiumAccess: {
    source: dto.premiumSource ?? null,
    endsAt: toNullableDate(dto.premiumEndsAt),
    // nullish-strict: 생략(undefined)은 이 필드 전 서버라는 뜻이고, 그 서버의 premiumEndsAt이 지금 기간의 끝이었다.
    // null은 프리미엄이 아니라는 서버 값이라 그대로 둔다
    periodEndsAt:
      dto.premiumPeriodEndsAt === undefined
        ? toNullableDate(dto.premiumEndsAt)
        : toNullableDate(dto.premiumPeriodEndsAt),
    willRenew: dto.willRenew ?? false,
    bankedDays: dto.bankedPremiumDays ?? 0,
    grantEndedAt: toNullableDate(dto.premiumGrantEndedAt),
  },
  // 구버전 서버는 생략하므로 null로 두고 정책이 프리미엄 출처·카탈로그로 판단한다
  isPremium: dto.isPremium ?? null,
  entitlements: dto.entitlements == null ? null : toPremiumEntitlements(dto.entitlements),
  createdAt: new Date(dto.createdAt),
});

export const toUpdateProfileResult = (dto: UpdateProfileResponse): UpdateProfileResult => ({
  name: dto.name,
  profileImage: dto.profileImage,
});
