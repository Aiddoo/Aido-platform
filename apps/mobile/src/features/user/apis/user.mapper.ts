import type { CurrentUser, UpdateProfileResponse } from '@aido/api';

import type { UpdateProfileResult, User } from '../domains/user.model';

const toNullableDate = (value: string | null | undefined) =>
  value == null ? null : new Date(value);

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
  createdAt: new Date(dto.createdAt),
});

export const toUpdateProfileResult = (dto: UpdateProfileResponse): UpdateProfileResult => ({
  name: dto.name,
  profileImage: dto.profileImage,
});
