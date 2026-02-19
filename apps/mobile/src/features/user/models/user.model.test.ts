import type { User } from './user.model';
import { UserPolicy } from './user.model';

const createUser = (overrides?: Partial<User>): User => ({
  id: 'test-id',
  email: 'test@example.com',
  name: '테스트',
  profileImage: null,
  userTag: 'TEST2025',
  subscriptionStatus: 'FREE',
  createdAt: new Date('2026-01-01T09:00:00.000Z'),
  ...overrides,
});

describe('UserPolicy', () => {
  describe('isPremiumUser', () => {
    test('ACTIVE 구독이면 true를 반환한다', () => {
      const user = createUser({ subscriptionStatus: 'ACTIVE' });
      expect(UserPolicy.isPremiumUser(user)).toBe(true);
    });

    test.each([
      'FREE',
      'EXPIRED',
      'CANCELLED',
    ] as const)('%s 구독이면 false를 반환한다', (status) => {
      const user = createUser({ subscriptionStatus: status });
      expect(UserPolicy.isPremiumUser(user)).toBe(false);
    });
  });
});
