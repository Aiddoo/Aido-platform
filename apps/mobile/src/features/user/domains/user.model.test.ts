import { createPremiumAccess } from '@src/features/subscription/__tests__/premium-access.factories';
import { createPremiumEntitlements } from '@src/features/subscription/__tests__/premium-entitlement.factories';

import type { User } from './user.model';
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
  entitlements: createPremiumEntitlements(),
  createdAt: new Date('2026-01-01T09:00:00.000Z'),
  ...overrides,
});

describe('UserPolicy', () => {
  describe('isPremiumUser', () => {
    test.each(['STORE', 'GRANT'] as const)(
      '출처가 %s이고 서버가 유효하다고 판단하면 true를 반환한다',
      (source) => {
        // Given 서버가 계산한 유효 프리미엄이다
        const user = createUser({
          isPremium: true,
          premiumAccess: createPremiumAccess({ source }),
        });

        // When / Then
        expect(UserPolicy.isPremiumUser(user)).toBe(true);
      },
    );

    test('서버의 유효 프리미엄 판단이 있으면 출처보다 그 값을 따른다', () => {
      // Given 자동 갱신 유예가 끝나 서버는 효력이 없다고 판단했다
      const user = createUser({
        isPremium: false,
        premiumAccess: createPremiumAccess({ source: 'STORE' }),
      });

      // When / Then
      expect(UserPolicy.isPremiumUser(user)).toBe(false);
    });

    test('ADMIN은 서버 isPremium이 false여도 true를 반환한다', () => {
      // Given 서버 isPremium은 ADMIN을 반영하지 않는다
      const user = createUser({ role: 'ADMIN', isPremium: false });

      // When / Then
      expect(UserPolicy.isPremiumUser(user)).toBe(true);
    });

    test('구독 상태가 ACTIVE여도 서버가 효력이 없다고 판단하면 false를 반환한다', () => {
      // Given 스토어 만료 뒤 상태 값만 ACTIVE로 남았다
      const user = createUser({
        subscriptionStatus: 'ACTIVE',
        premiumAccess: createPremiumAccess({ source: null, endsAt: null, periodEndsAt: null }),
      });

      // When / Then
      expect(UserPolicy.isPremiumUser(user)).toBe(false);
    });

    test('ADMIN role이면 프리미엄 출처와 무관하게 true를 반환한다', () => {
      // Given
      const user = createUser({ role: 'ADMIN' });

      // When / Then
      expect(UserPolicy.isPremiumUser(user)).toBe(true);
    });
  });

  describe('tier', () => {
    test('만료돼 출처가 없는 ACTIVE 사용자는 BASIC이다', () => {
      // Given
      const user = createUser({ subscriptionStatus: 'ACTIVE' });

      // When / Then
      expect(UserPolicy.tier(user)).toBe('BASIC');
    });

    test('보상 기간 중인 사용자는 PREMIUM이다', () => {
      // Given
      const user = createUser({
        isPremium: true,
        premiumAccess: createPremiumAccess({ source: 'GRANT' }),
      });

      // When / Then
      expect(UserPolicy.tier(user)).toBe('PREMIUM');
    });
  });

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
});
