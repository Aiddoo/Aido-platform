import { PREMIUM_ME_EXAMPLES } from '@src/features/identity/user/__tests__/premium-access.fixtures';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { toUser } from '@src/features/identity/user/apis/user.mapper';
import { toInstant } from '@src/shared/date/instant';

import { createPendingRedemption, createRedemptionResult } from '../__tests__/invite.fixtures';
import {
  InviteePremiumAccessPolicy,
  InviteeUserPolicy,
  InviteRedemptionPolicy,
  PendingRedemptionPolicy,
} from './invite-redemption.model';

const inviter = {
  userId: 'clz7x5p8k0001qz0z8z8z8z8z',
  name: '민지',
  userTag: 'K3MQ9XWA',
  profileImage: 'orange_tabby',
};

describe('isFresh', () => {
  it('저장한 지 7일이 안 됐으면 true를 반환한다', () => {
    // Given
    const pending = createPendingRedemption({ savedAt: toInstant('2028-02-23T00:00:00Z') });

    // When
    const result = PendingRedemptionPolicy.isFresh(pending, toInstant('2028-02-29T23:59:59Z'));

    // Then
    // 윤년 2월 29일까지 포함해 6일 23시간 59분 59초
    expect(result).toBe(true);
  });

  it('저장한 지 정확히 7일이 지나면 false를 반환한다', () => {
    // Given
    const pending = createPendingRedemption({ savedAt: toInstant('2028-02-23T00:00:00Z') });

    // When
    const result = PendingRedemptionPolicy.isFresh(pending, toInstant('2028-03-01T00:00:00Z'));

    // Then
    // 2월 23일 + 7일 = 3월 1일 (윤년)
    expect(result).toBe(false);
  });
});

describe('getFriendship', () => {
  it.each(['FRIENDS', 'REQUESTED'] as const)(
    '새로 수락해 %s가 되면 그 친구 상태를 반환한다',
    (friendship) => {
      // Given
      const result = createRedemptionResult({ friendship });

      // When
      const actual = InviteRedemptionPolicy.getFriendship(result);

      // Then
      expect(actual).toBe(friendship);
    },
  );

  it('이미 친구였으면 친구 상태가 바뀌지 않아 null을 반환한다', () => {
    // Given
    const result = { outcome: 'ALREADY_FRIENDS' as const, inviter };

    // When
    const actual = InviteRedemptionPolicy.getFriendship(result);

    // Then
    expect(actual).toBeNull();
  });
});

describe('isAlreadyFriends', () => {
  it.each([
    ['이미 친구였으면', { outcome: 'ALREADY_FRIENDS' as const, inviter }, true],
    ['보상을 받고 친구가 됐으면', createRedemptionResult(), false],
    [
      '기존 사용자가 친구를 맺었으면',
      { outcome: 'CONNECTED' as const, inviter, friendship: 'FRIENDS' as const },
      false,
    ],
  ])('%s %s를 반환한다', (_case, result, expected) => {
    // When
    const isAlreadyFriends = InviteRedemptionPolicy.isAlreadyFriends(result);

    // Then
    expect(isAlreadyFriends).toBe(expected);
  });
});

describe('isFriendRequestOnly', () => {
  it.each([
    ['보상을 받고 친구 요청만 갔으면', createRedemptionResult({ friendship: 'REQUESTED' }), true],
    [
      '기존 사용자가 친구 요청만 보냈으면',
      { outcome: 'CONNECTED' as const, inviter, friendship: 'REQUESTED' as const },
      true,
    ],
    ['보상을 받고 친구가 됐으면', createRedemptionResult(), false],
    ['이미 친구였으면', { outcome: 'ALREADY_FRIENDS' as const, inviter }, false],
  ])('%s %s를 반환한다', (_case, result, expected) => {
    // When
    const isRequestOnly = InviteRedemptionPolicy.isFriendRequestOnly(result);

    // Then
    expect(isRequestOnly).toBe(expected);
  });
});

describe('isAlreadyAccepted', () => {
  it.each([
    ['서버가 처음 결과를 다시 돌려줬으면', createRedemptionResult({ isReplay: true }), true],
    ['처음 수락했으면', createRedemptionResult({ isReplay: false }), false],
    ['isReplay가 없는 구버전 서버 응답이면', createRedemptionResult(), false],
    ['이미 친구였으면', { outcome: 'ALREADY_FRIENDS' as const, inviter }, false],
  ])('%s %s를 반환한다', (_case, result, expected) => {
    // When
    const isAlreadyAccepted = InviteRedemptionPolicy.isAlreadyAccepted(result);

    // Then
    expect(isAlreadyAccepted).toBe(expected);
  });
});

describe('getGrantedPremiumDays', () => {
  it('REDEEMED 보상 중 프리미엄 일수만 더해 반환한다', () => {
    // Given
    const result = createRedemptionResult({
      rewards: [
        { rewardType: 'PREMIUM_DAYS', quantity: 7 },
        { rewardType: 'UNKNOWN', quantity: 0 },
      ],
    });

    // When
    const days = InviteRedemptionPolicy.getGrantedPremiumDays(result);

    // Then
    expect(days).toBe(7);
  });

  it('보상이 없는 결과는 0을 반환한다', () => {
    // Given
    const result = { outcome: 'CONNECTED' as const, inviter, friendship: 'FRIENDS' as const };

    // When
    const days = InviteRedemptionPolicy.getGrantedPremiumDays(result);

    // Then
    expect(days).toBe(0);
  });
});

describe('getMissingRewardReason', () => {
  it.each([
    ['보상을 받았으면', createRedemptionResult(), null],
    ['같은 기기로 다시 받으려 했으면', createRedemptionResult({ rewards: [] }), 'already-claimed'],
    [
      '기존 사용자면',
      { outcome: 'CONNECTED' as const, inviter, friendship: 'FRIENDS' as const },
      'existing-account',
    ],
    ['이미 친구였으면', { outcome: 'ALREADY_FRIENDS' as const, inviter }, null],
  ])('%s %s를 반환한다', (_case, result, expected) => {
    // When
    const reason = InviteRedemptionPolicy.getMissingRewardReason(result);

    // Then
    expect(reason).toBe(expected);
  });
});

describe('getRewardStart', () => {
  it.each([
    ['무료였다가 보상을 받았으면 바로', PREMIUM_ME_EXAMPLES.newRewardAfterEnded, 'now'],
    [
      '자동 갱신 구독 중이면 구독이 끝난 뒤로',
      PREMIUM_ME_EXAMPLES.rewardDuringRenewingSubscription,
      'after-subscription',
    ],
    [
      '취소한 구독이 남아 있어도 구독이 끝난 뒤로',
      PREMIUM_ME_EXAMPLES.cancelledWithBanked,
      'after-subscription',
    ],
    [
      '다른 보상 기간 중이면 그 보상 뒤로',
      PREMIUM_ME_EXAMPLES.rewardDuringReward,
      'after-current-reward',
    ],
  ] as const)('%s 시작한다', (_case, me, expected) => {
    // Given
    // 수락 뒤 다시 불러온 내 정보(서버 /me 그대로)
    const { premiumAccess } = toUser(me);

    // When
    const result = InviteePremiumAccessPolicy.getRewardStart(premiumAccess);

    // Then
    expect(result).toBe(expected);
  });
});

describe('isRewardExpected', () => {
  it('가입한 지 7일이 안 됐으면 true를 반환한다', () => {
    // Given
    const user = createUser({ createdAt: toInstant('2026-10-19T00:00:01Z') });
    const now = toInstant('2026-10-26T00:00:00Z');

    // When
    const result = InviteeUserPolicy.isRewardExpected(user, now);

    // Then
    expect(result).toBe(true);
  });

  it('가입한 지 정확히 7일이 지났으면 false를 반환한다', () => {
    // Given
    const user = createUser({ createdAt: toInstant('2026-10-19T00:00:00Z') });
    const now = toInstant('2026-10-26T00:00:00Z');

    // When
    const result = InviteeUserPolicy.isRewardExpected(user, now);

    // Then
    // 7일 = 7 × 24시간, 기간 안이 아니다
    expect(result).toBe(false);
  });
});
