import type { UpdateProfileResponse } from '@aido/api';
import { toInstant, toNullableInstant } from '@src/shared/date/instant';

import { type UpdateProfileResult, type User } from '../domains/user.model';
import { type CurrentUserResponse } from '../schemas/user-response.schema';

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
      bankedDays: dto.bankedPremiumDays,
      grantEndedAt: toNullableInstant(dto.premiumGrantEndedAt),
    },
    isPremium: dto.isPremium,
    createdAt: toInstant(dto.createdAt),
  };
}

export function toUpdateProfileResult(dto: UpdateProfileResponse): UpdateProfileResult {
  return { name: dto.name, profileImage: dto.profileImage };
}
