import type { CurrentUser, UpdateProfileResponse } from '@aido/api';

import type { UpdateProfileResult, User } from '../domains/user.model';

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
    endsAt: dto.premiumEndsAt == null ? null : new Date(dto.premiumEndsAt),
    willRenew: dto.willRenew ?? false,
    bankedDays: dto.bankedPremiumDays ?? 0,
  },
  createdAt: new Date(dto.createdAt),
});

export const toUpdateProfileResult = (dto: UpdateProfileResponse): UpdateProfileResult => ({
  name: dto.name,
  profileImage: dto.profileImage,
});
