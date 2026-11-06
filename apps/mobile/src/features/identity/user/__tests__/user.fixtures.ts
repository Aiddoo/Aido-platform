import type { UpdateProfileResponse } from '@aido/api';
import { ApiError } from '@src/shared/errors/api-error';

import type { CurrentUserResponse } from '../schemas/user.schema';

const generateCurrentUserDto = (): CurrentUserResponse => ({
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
  isPremium: false,
});

export const createCurrentUserDto = (
  overrides?: Partial<CurrentUserResponse>,
): CurrentUserResponse => ({
  ...generateCurrentUserDto(),
  ...overrides,
});

const generateUpdateProfileDto = (): UpdateProfileResponse => ({
  message: '프로필이 수정되었습니다.',
  name: '새이름',
  profileImage: 'https://example.com/new.jpg',
});

export const createUpdateProfileDto = (
  overrides?: Partial<UpdateProfileResponse>,
): UpdateProfileResponse => ({
  ...generateUpdateProfileDto(),
  ...overrides,
});

export const createUserApiError = (
  overrides?: Partial<{ code: string; message: string; status: number }>,
) =>
  new ApiError(
    overrides?.code ?? 'USER_NOT_FOUND',
    overrides?.message ?? '사용자를 찾을 수 없습니다',
    overrides?.status ?? 404,
  );

export const INVALID_DTO = { invalid: 'data' };
