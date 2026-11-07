import { toInstant } from '@src/shared/date/instant';

import type { User } from '../schemas/user.schema';
import { UserPolicy } from './user.model';

const createUser = (overrides?: Partial<User>): User => ({
  id: 'test-id',
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
    bankedDays: 0,
    grantEndedAt: null,
  },
  isPremium: false,
  createdAt: toInstant('2026-01-01T09:00:00.000Z'),
  ...overrides,
});

describe('UserPolicy', () => {
  describe('hasCredential', () => {
    test('CREDENTIAL provider가 있으면 true를 반환한다', () => {
      const user = createUser({ providers: ['CREDENTIAL'] });
      expect(UserPolicy.hasCredential(user)).toBe(true);
    });

    test('CREDENTIAL provider가 없으면 false를 반환한다', () => {
      const user = createUser({ providers: ['GOOGLE'] });
      expect(UserPolicy.hasCredential(user)).toBe(false);
    });

    test('providers가 비어있으면 false를 반환한다', () => {
      const user = createUser({ providers: [] });
      expect(UserPolicy.hasCredential(user)).toBe(false);
    });
  });

  describe('isAdmin', () => {
    test.each([
      ['ADMIN', true],
      ['USER', false],
    ] as const)('역할이 %s면 %s를 반환한다', (role, expected) => {
      expect(UserPolicy.isAdmin(createUser({ role }))).toBe(expected);
    });
  });

  describe('hasPremiumAccess / isFreeUser', () => {
    test.each([
      // [역할, 서버 isPremium, 결제 사용자인가]
      ['USER', false, false],
      ['USER', true, true],
      ['ADMIN', false, true],
      ['ADMIN', true, true],
    ] as const)('역할 %s, 서버 isPremium %s면 결제 사용자는 %s다', (role, isPremium, expected) => {
      // Given 서버의 isPremium은 ADMIN을 반영하지 않는다
      const user = createUser({ role, isPremium });

      // When / Then
      expect(UserPolicy.hasPremiumAccess(user)).toBe(expected);
      expect(UserPolicy.isFreeUser(user)).toBe(!expected);
    });
  });

  describe('hasEntitlementChanged', () => {
    test('역할이 바뀌면 true를 반환한다', () => {
      expect(UserPolicy.hasEntitlementChanged(createUser(), createUser({ role: 'ADMIN' }))).toBe(
        true,
      );
    });

    test('프리미엄 효력이 바뀌면 true를 반환한다', () => {
      expect(UserPolicy.hasEntitlementChanged(createUser(), createUser({ isPremium: true }))).toBe(
        true,
      );
    });

    test('아무것도 바뀌지 않으면 false를 반환한다', () => {
      expect(UserPolicy.hasEntitlementChanged(createUser(), createUser())).toBe(false);
    });
  });
});
