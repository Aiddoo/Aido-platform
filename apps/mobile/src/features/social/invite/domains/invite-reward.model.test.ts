import { REWARD_TYPE_UNKNOWN } from '@aido/api/vocabulary';

import type { InviteReward } from '../schemas/invite-reward.schema';
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

const createReward = (overrides: Partial<InviteReward> = {}): InviteReward => ({
  rewardType: 'PREMIUM_DAYS',
  quantity: 7,
  ...overrides,
});

describe('getPremiumDays', () => {
  it('프리미엄 일수 보상만 더한다', () => {
    // Given
    const rewards = [
      createReward({ rewardType: 'PREMIUM_DAYS', quantity: 7 }),
      createReward({ rewardType: 'FRIEND_SLOT', quantity: 1 }),
      createReward({ rewardType: 'PREMIUM_DAYS', quantity: 30 }),
    ];

    // When
    const days = InviteRewardPolicy.getPremiumDays(rewards);

    // Then
    // 7 + 30 = 37
    expect(days).toBe(37);
  });

  it('앱이 모르는 보상 종류는 세지 않는다', () => {
    // Given
    const rewards = [createReward({ rewardType: REWARD_TYPE_UNKNOWN, quantity: 0 })];

    // When
    const days = InviteRewardPolicy.getPremiumDays(rewards);

    // Then
    expect(days).toBe(0);
  });

  it('보상이 없으면 0일이다', () => {
    // When
    const days = InviteRewardPolicy.getPremiumDays([]);

    // Then
    expect(days).toBe(0);
  });
});

describe('getFriendSlots', () => {
  it('친구 칸 보상만 더한다', () => {
    // Given
    const rewards = [
      createReward({ rewardType: 'FRIEND_SLOT', quantity: 1 }),
      createReward({ rewardType: 'PREMIUM_DAYS', quantity: 7 }),
      createReward({ rewardType: 'FRIEND_SLOT', quantity: 2 }),
    ];

    // When
    const slots = InviteRewardPolicy.getFriendSlots(rewards);

    // Then
    // 1 + 2 = 3
    expect(slots).toBe(3);
  });

  it('친구 칸 보상이 없으면 0칸이다', () => {
    // Given
    const rewards = [createReward({ rewardType: 'PREMIUM_DAYS', quantity: 7 })];

    // When
    const slots = InviteRewardPolicy.getFriendSlots(rewards);

    // Then
    expect(slots).toBe(0);
  });
});
