import type { UpdateProfileResponse } from '@aido/api';
import type { ErrorCodeType } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import { toInstant } from '@src/shared/date/instant';

import { type User, userSchema } from '../domains/user.model';
import { type CurrentUserResponse } from '../schemas/user-response.schema';

function generateCurrentUserDto(): CurrentUserResponse {
  return {
    userId: 'clz7x5p8k0001qz0z8z8z8z8z',
    email: 'test@example.com',
    sessionId: 'clz7x5p8k0002qz0z8z8z8z8z',
    userTag: 'TEST2025',
    role: 'USER',
    status: 'ACTIVE',
    emailVerifiedAt: '2026-01-15T10:30:00.000Z',
    subscriptionStatus: 'ACTIVE',
    subscriptionExpiresAt: null,
    name: '테스트',
    profileImage: null,
    createdAt: '2026-01-01T09:00:00.000Z',
    providers: ['CREDENTIAL'],
    premiumSource: null,
    premiumEndsAt: null,
    premiumPeriodEndsAt: null,
    willRenew: false,
    bankedPremiumDays: 0,
    premiumGrantEndedAt: null,
    premiumIsTrial: false,
    isPremium: false,
  };
}

export function createCurrentUserDto(
  overrides?: Partial<CurrentUserResponse>,
): CurrentUserResponse {
  return { ...generateCurrentUserDto(), ...overrides };
}

export function createUser(overrides?: Partial<User>): User {
  return userSchema.parse({
    id: 'user-1',
    email: 'test@example.com',
    name: '테스트',
    profileImage: null,
    userTag: 'TEST2025',
    role: 'USER',
    subscriptionStatus: 'FREE',
    subscriptionExpiresAt: null,
    providers: ['CREDENTIAL'],
    premiumAccess: {
      source: null,
      endsAt: null,
      periodEndsAt: null,
      willRenew: false,
      isTrial: false,
      bankedDays: 0,
      grantEndedAt: null,
    },
    isPremium: false,
    createdAt: toInstant('2026-01-01T09:00:00.000Z'),
    ...overrides,
  });
}

function generateUpdateProfileDto(): UpdateProfileResponse {
  return {
    message: '프로필이 수정되었습니다.',
    name: '새이름',
    profileImage: 'https://example.com/new.jpg',
  };
}

export function createUpdateProfileDto(
  overrides?: Partial<UpdateProfileResponse>,
): UpdateProfileResponse {
  return {
    ...generateUpdateProfileDto(),
    ...overrides,
  };
}

export function createUserApiError(
  overrides?: Partial<{ code: ErrorCodeType; message: string; status: number }>,
) {
  return new ApiError(
    overrides?.code ?? 'USER_0601',
    overrides?.message ?? '사용자를 찾을 수 없습니다',
    overrides?.status ?? 404,
  );
}

export const INVALID_DTO = { invalid: 'data' };
