import { createPremiumAccess } from '@src/features/subscription/__tests__/premium-access.factories';

import { createPendingRedemption, createRedemptionResult } from '../__tests__/invite.factories';
import { isWithinDays, InviteRedemptionPolicy } from './invite-redemption.model';

describe('isWithinDays', () => {
  it('정확히 기간만큼 지나면 false를 반환한다', () => {
    // When
    const result = isWithinDays(
      new Date('2026-10-01T00:00:00Z'),
      new Date('2026-10-08T00:00:00Z'),
      7,
    );

    // Then 7일 = 7 × 24시간, 기간 안이 아니다
    expect(result).toBe(false);
  });

  it('기간이 1ms 남았으면 true를 반환한다', () => {
    // When
    const result = isWithinDays(
      new Date('2026-10-01T00:00:00.000Z'),
      new Date('2026-10-07T23:59:59.999Z'),
      7,
    );

    // Then
    expect(result).toBe(true);
  });
});

describe('InviteRedemptionPolicy', () => {
  describe('isFresh', () => {
    it('저장한 지 7일이 안 됐으면 true를 반환한다', () => {
      // Given
      const pending = createPendingRedemption({ savedAt: new Date('2028-02-23T00:00:00Z') });

      // When
      const result = InviteRedemptionPolicy.isFresh(pending, new Date('2028-02-29T23:59:59Z'));

      // Then 윤년 2월 29일까지 포함해 6일 23시간 59분 59초
      expect(result).toBe(true);
    });

    it('저장한 지 정확히 7일이 지나면 false를 반환한다', () => {
      // Given
      const pending = createPendingRedemption({ savedAt: new Date('2028-02-23T00:00:00Z') });

      // When
      const result = InviteRedemptionPolicy.isFresh(pending, new Date('2028-03-01T00:00:00Z'));

      // Then 2월 23일 + 7일 = 3월 1일 (윤년)
      expect(result).toBe(false);
    });
  });
});

const inviter = {
  userId: 'clz7x5p8k0001qz0z8z8z8z8z',
  name: '민지',
  userTag: 'K3MQ9XWA',
  profileImage: 'orange_tabby',
};

describe('InviteRedemptionPolicy', () => {
  describe('welcomeVariant', () => {
    it.each([
      ['보상을 받고 친구가 됐으면', createRedemptionResult(), 'friends-with-reward'],
      [
        '보상을 받고 친구 요청만 갔으면',
        createRedemptionResult({ friendship: 'REQUESTED' }),
        'requested-with-reward',
      ],
      [
        '같은 기기라 보상 없이 친구가 됐으면',
        createRedemptionResult({ rewards: [] }),
        'friends-only',
      ],
      [
        '기존 사용자가 친구를 맺었으면',
        { outcome: 'CONNECTED' as const, inviter, friendship: 'FRIENDS' as const },
        'friends-only',
      ],
      [
        '기존 사용자가 친구 요청만 보냈으면',
        { outcome: 'CONNECTED' as const, inviter, friendship: 'REQUESTED' as const },
        'requested-only',
      ],
      ['이미 친구였으면', { outcome: 'ALREADY_FRIENDS' as const, inviter }, 'already-friends'],
    ])('%s %s를 반환한다', (_case, result, expected) => {
      // When
      const variant = InviteRedemptionPolicy.welcomeVariant(result);

      // Then
      expect(variant).toBe(expected);
    });
  });

  describe('grantedPremiumDays', () => {
    it('REDEEMED 보상 중 프리미엄 일수만 더해 반환한다', () => {
      // Given
      const result = createRedemptionResult({
        rewards: [
          { rewardType: 'PREMIUM_DAYS', quantity: 7 },
          { rewardType: 'UNKNOWN', quantity: 0 },
        ],
      });

      // When
      const days = InviteRedemptionPolicy.grantedPremiumDays(result);

      // Then
      expect(days).toBe(7);
    });

    it('보상이 없는 결과는 0을 반환한다', () => {
      // When
      const days = InviteRedemptionPolicy.grantedPremiumDays({
        outcome: 'CONNECTED',
        inviter,
        friendship: 'FRIENDS',
      });

      // Then
      expect(days).toBe(0);
    });
  });

  describe('missingRewardReason', () => {
    it.each([
      ['보상을 받았으면', createRedemptionResult(), null],
      [
        '같은 기기로 다시 받으려 했으면',
        createRedemptionResult({ rewards: [] }),
        'already-claimed',
      ],
      [
        '기존 사용자면',
        { outcome: 'CONNECTED' as const, inviter, friendship: 'FRIENDS' as const },
        'existing-account',
      ],
      ['이미 친구였으면', { outcome: 'ALREADY_FRIENDS' as const, inviter }, null],
    ])('%s %s를 반환한다', (_case, result, expected) => {
      // When
      const reason = InviteRedemptionPolicy.missingRewardReason(result);

      // Then
      expect(reason).toBe(expected);
    });
  });

  describe('isRewardExpected', () => {
    it('가입한 지 7일이 안 됐으면 true를 반환한다', () => {
      // When
      const result = InviteRedemptionPolicy.isRewardExpected(
        new Date('2026-10-19T00:00:01Z'),
        new Date('2026-10-26T00:00:00Z'),
      );

      // Then
      expect(result).toBe(true);
    });

    it('가입한 지 정확히 7일이 지났으면 false를 반환한다', () => {
      // When
      const result = InviteRedemptionPolicy.isRewardExpected(
        new Date('2026-10-19T00:00:00Z'),
        new Date('2026-10-26T00:00:00Z'),
      );

      // Then
      expect(result).toBe(false);
    });
  });
});

describe('InviteRedemptionPolicy.rewardStart', () => {
  it.each([
    ['무료였으면 보상이 바로 시작해', { source: 'GRANT', bankedDays: 0 }, 'now'],
    [
      '스토어 구독 중이면 구독이 끝난 뒤로',
      { source: 'STORE', bankedDays: 7 },
      'after-subscription',
    ],
    [
      '다른 보상 기간 중이면 그 보상 뒤로',
      { source: 'GRANT', bankedDays: 7 },
      'after-current-reward',
    ],
    [
      '자동 갱신 구독이어도 이어 붙인 보상이 없으면 바로',
      { source: 'STORE', bankedDays: 0 },
      'now',
    ],
    ['내 정보에 프리미엄이 아직 없으면 바로', { source: null, bankedDays: 0 }, 'now'],
  ] as const)('%s %s를 반환한다', (_case, overrides, expected) => {
    // Given 수락 뒤 다시 불러온 내 정보
    const premiumAccess = createPremiumAccess(overrides);

    // When
    const result = InviteRedemptionPolicy.rewardStart(premiumAccess);

    // Then
    expect(result).toBe(expected);
  });
});
