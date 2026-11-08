import { InviteRewardPolicy } from './invite-reward.model';

describe('calculateRewardQuantity', () => {
  it('고른 종류의 수량만 더해서 반환한다', () => {
    // Given
    const rewards = [
      { rewardType: 'PREMIUM_DAYS', quantity: 7 },
      { rewardType: 'FRIEND_SLOT', quantity: 1 },
      { rewardType: 'PREMIUM_DAYS', quantity: 7 },
    ] as const;

    // When
    const result = InviteRewardPolicy.calculateRewardQuantity(
      rewards,
      InviteRewardPolicy.isPremiumDaysReward,
    );

    // Then
    // 7 + 7 = 14
    expect(result).toBe(14);
  });

  it('보상이 없으면 0을 반환한다', () => {
    // When
    const result = InviteRewardPolicy.calculateRewardQuantity(
      [],
      InviteRewardPolicy.isPremiumDaysReward,
    );

    // Then
    expect(result).toBe(0);
  });
});
