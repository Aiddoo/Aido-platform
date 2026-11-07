import { toInstant } from '@src/shared/date/instant';

import type { User } from '../schemas/user.schema';
import { UserPolicy } from './user.model';

function createUser(overrides?: Partial<User>): User {
  return {
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
  };
}

describe('hasCredential', () => {
  it('CREDENTIAL provider가 있으면 true를 반환한다', () => {
    // Given
    const user = createUser({ providers: ['CREDENTIAL'] });

    // When
    const result = UserPolicy.hasCredential(user);

    // Then
    expect(result).toBe(true);
  });

  it('소셜 provider만 있으면 비밀번호가 없으므로 false를 반환한다', () => {
    // Given
    const user = createUser({ providers: ['GOOGLE'] });

    // When
    const result = UserPolicy.hasCredential(user);

    // Then
    expect(result).toBe(false);
  });

  it('providers가 비어 있으면 false를 반환한다', () => {
    // Given
    const user = createUser({ providers: [] });

    // When
    const result = UserPolicy.hasCredential(user);

    // Then
    expect(result).toBe(false);
  });
});

describe('isAdmin', () => {
  it.each([
    ['ADMIN', true],
    ['USER', false],
  ] as const)('역할이 %s면 %s를 반환한다', (role, expected) => {
    // Given
    const user = createUser({ role });

    // When
    const result = UserPolicy.isAdmin(user);

    // Then
    expect(result).toBe(expected);
  });
});

describe('hasPremiumAccess', () => {
  it.each([
    ['USER', false, false],
    ['USER', true, true],
    ['ADMIN', false, true],
    ['ADMIN', true, true],
  ] as const)('역할 %s, 서버 isPremium %s면 결제 사용자는 %s다', (role, isPremium, expected) => {
    // Given
    const user = createUser({ role, isPremium });

    // When
    const result = UserPolicy.hasPremiumAccess(user);

    // Then
    // 서버의 isPremium은 ADMIN을 반영하지 않는다
    expect(result).toBe(expected);
  });
});

describe('hasEntitlementChanged', () => {
  it('역할이 바뀌면 true를 반환한다', () => {
    // Given
    const previous = createUser();
    const next = createUser({ role: 'ADMIN' });

    // When
    const result = UserPolicy.hasEntitlementChanged(previous, next);

    // Then
    expect(result).toBe(true);
  });

  it('프리미엄 효력이 바뀌면 true를 반환한다', () => {
    // Given
    const previous = createUser();
    const next = createUser({ isPremium: true });

    // When
    const result = UserPolicy.hasEntitlementChanged(previous, next);

    // Then
    expect(result).toBe(true);
  });

  it('아무것도 바뀌지 않으면 false를 반환한다', () => {
    // Given
    const previous = createUser();
    const next = createUser();

    // When
    const result = UserPolicy.hasEntitlementChanged(previous, next);

    // Then
    expect(result).toBe(false);
  });
});
