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
  createdAt: new Date('2026-01-01T09:00:00.000Z'),
  ...overrides,
});

describe('UserPolicy', () => {
  describe('isPremiumUser', () => {
    test('ACTIVE 구독이면 true를 반환한다', () => {
      const user = createUser({ subscriptionStatus: 'ACTIVE' });
      expect(UserPolicy.isPremiumUser(user)).toBe(true);
    });

    test('ADMIN role이면 구독 상태와 무관하게 true를 반환한다', () => {
      const user = createUser({ role: 'ADMIN', subscriptionStatus: 'FREE' });
      expect(UserPolicy.isPremiumUser(user)).toBe(true);
    });

    test.each(['FREE', 'EXPIRED', 'CANCELLED'] as const)(
      '%s 구독이면 false를 반환한다',
      (status) => {
        const user = createUser({ subscriptionStatus: status });
        expect(UserPolicy.isPremiumUser(user)).toBe(false);
      },
    );
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
