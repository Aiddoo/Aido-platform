import { createRedemptionResult } from '../__tests__/invite.fixtures';
import { InviteRedemptionPolicy } from './invite-redemption.model';

const inviter = {
  userId: 'clz7x5p8k0001qz0z8z8z8z8z',
  name: '민지',
  userTag: 'K3MQ9XWA',
  profileImage: 'orange_tabby',
};

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
