import {
  calculateRewardQuantity,
  InviteRewardPolicy,
  InviteRewardSchema,
  isPremiumDaysReward,
} from './invite-reward.model';

describe('InviteRewardSchema', () => {
  it('모르는 보상 종류를 받으면 UNKNOWN 0개를 반환한다', () => {
    // When
    const result = InviteRewardSchema.parse({ rewardType: 'BADGE', quantity: 1 });

    // Then
    expect(result).toEqual({ rewardType: 'UNKNOWN', quantity: 0 });
  });
});

describe('calculateRewardQuantity', () => {
  it('고른 종류의 수량만 더해서 반환한다', () => {
    // When
    const result = calculateRewardQuantity(
      [
        { rewardType: 'PREMIUM_DAYS', quantity: 7 },
        { rewardType: 'FRIEND_SLOT', quantity: 1 },
        { rewardType: 'PREMIUM_DAYS', quantity: 7 },
      ],
      isPremiumDaysReward,
    );

    // Then 7 + 7 = 14
    expect(result).toBe(14);
  });

  it('보상이 없으면 0을 반환한다', () => {
    // When
    const result = calculateRewardQuantity([], isPremiumDaysReward);

    // Then
    expect(result).toBe(0);
  });
});

describe('InviteRewardPolicy', () => {
  describe('welcomePremiumDays', () => {
    it('초대받은 사람 보상 표의 프리미엄 일수를 반환한다', () => {
      // When
      const result = InviteRewardPolicy.welcomePremiumDays();

      // Then INVITEE_REWARDS의 PREMIUM_DAYS 7
      expect(result).toBe(7);
    });
  });
});
