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

describe('getWelcomePremiumDays', () => {
  it('초대받은 사람 보상 표의 프리미엄 일수를 반환한다', () => {
    // When
    const result = InviteRewardPolicy.getWelcomePremiumDays();

    // Then
    // INVITEE_REWARDS의 PREMIUM_DAYS 7
    expect(result).toBe(7);
  });
});

describe('getInviterPremiumDays', () => {
  it('초대받은 사람 보상이 아니라 초대한 사람 첫 단계 보상의 프리미엄 일수를 반환한다', () => {
    // When
    const result = InviteRewardPolicy.getInviterPremiumDays();

    // Then
    // INVITER_REWARD_MILESTONES[0]의 PREMIUM_DAYS 7 (친구 추가 +1명은 세지 않는다)
    expect(result).toBe(7);
  });
});
