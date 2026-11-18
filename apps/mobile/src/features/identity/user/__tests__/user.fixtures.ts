import { updateProfileResponseSchema } from '@aido/api/contracts/auth/v1';
import { defineFixture } from '@src/testing/fixture';

import { userSchema } from '../domains/user.model';
import { currentUserResponseSchema } from '../schemas/user-response.schema';

export const createCurrentUserDto = defineFixture(currentUserResponseSchema, {
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
});

export const createUser = defineFixture(userSchema, {
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
    planType: null,
  },
  isPremium: false,
  createdAt: '2026-01-01T09:00:00.000Z',
});

export const createUpdateProfileDto = defineFixture(updateProfileResponseSchema, {
  message: '프로필이 수정되었습니다.',
  name: '새이름',
  profileImage: 'https://example.com/new.jpg',
});
