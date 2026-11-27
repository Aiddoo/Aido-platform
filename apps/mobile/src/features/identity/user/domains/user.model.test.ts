import { toInstant } from '@src/shared/date/instant';

import { createUser } from '../__tests__/user.fixtures';
import { UserPolicy } from './user.model';

describe('UserPolicy', () => {
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

  describe('isNeverSubscribed', () => {
    it.each([
      ['FREE', true],
      ['ACTIVE', false],
      ['EXPIRED', false],
      ['CANCELLED', false],
    ] as const)(
      '구독 상태가 %s면 한 번도 구독하지 않았는지 %s다',
      (subscriptionStatus, expected) => {
        // Given
        const user = createUser({ subscriptionStatus });

        // When
        const result = UserPolicy.isNeverSubscribed(user);

        // Then
        expect(result).toBe(expected);
      },
    );
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

  describe('isInviteRewardExpected', () => {
    it('가입한 지 7일이 안 됐으면 true를 반환한다', () => {
      // Given
      const user = createUser({ createdAt: toInstant('2026-10-19T00:00:01Z') });
      const now = toInstant('2026-10-26T00:00:00Z');

      // When
      const result = UserPolicy.isInviteRewardExpected(user, now);

      // Then
      expect(result).toBe(true);
    });

    it('가입한 지 정확히 7일이 지났으면 false를 반환한다', () => {
      // Given
      const user = createUser({ createdAt: toInstant('2026-10-19T00:00:00Z') });
      const now = toInstant('2026-10-26T00:00:00Z');

      // When
      const result = UserPolicy.isInviteRewardExpected(user, now);

      // Then
      // 7일 = 7 × 24시간, 기간 안이 아니다
      expect(result).toBe(false);
    });
  });
});
