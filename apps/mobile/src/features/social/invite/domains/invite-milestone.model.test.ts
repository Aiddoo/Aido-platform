import { INVITER_REWARD_MILESTONES } from '@aido/api/vocabulary';

import { type InviteMilestone, InviteMilestonePolicy } from './invite-milestone.model';

function createMilestone(overrides: Partial<InviteMilestone> = {}): InviteMilestone {
  return {
    qualifiedCount: 3,
    repeatEvery: null,
    rewards: [{ rewardType: 'PREMIUM_DAYS', quantity: 7 }],
    ...overrides,
  };
}

describe('InviteMilestonePolicy', () => {
  describe('isOneTime', () => {
    it('반복 간격이 없는 단계면 true를 반환한다', () => {
      // Given
      const milestone = createMilestone({ repeatEvery: null });

      // When
      const result = InviteMilestonePolicy.isOneTime(milestone);

      // Then
      expect(result).toBe(true);
    });

    it('반복 간격이 있는 단계면 false를 반환한다', () => {
      // Given
      const milestone = createMilestone({ repeatEvery: 1 });

      // When
      const result = InviteMilestonePolicy.isOneTime(milestone);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('getPremiumDays', () => {
    it('단계 보상 중 프리미엄 일수만 더한다', () => {
      // Given
      const milestone = createMilestone({
        rewards: [
          { rewardType: 'PREMIUM_DAYS', quantity: 7 },
          { rewardType: 'FRIEND_SLOT', quantity: 1 },
        ],
      });

      // When
      const days = InviteMilestonePolicy.getPremiumDays(milestone);

      // Then
      expect(days).toBe(7);
    });

    it('앱에 묶은 첫 단계 카탈로그도 같은 모양으로 읽는다', () => {
      // Given
      const [firstMilestone] = INVITER_REWARD_MILESTONES;

      // When
      const days = InviteMilestonePolicy.getPremiumDays(firstMilestone);

      // Then
      expect(days).toBe(7);
    });
  });
});
