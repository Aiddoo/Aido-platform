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
  createdAt: new Date('2026-01-01T09:00:00.000Z'),
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
});
