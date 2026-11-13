import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { InviteRedemptionId } from "./invite-redemption-id.vo.js";
import {
  capRewards,
  type InviterRewardMilestone,
  isMilestoneReachedAt,
  nextInviteMilestone,
  nextMilestoneQualifiedCount,
  planInviteeRewards,
  planInviterRewards,
  premiumCapState,
  remainingPremiumDays,
  rewardCapWindowStart,
  rewardsAtQualifiedCount,
  summarizeInviterRewards,
} from "./invite-reward.domain-service.js";

const MILESTONES = [
  {
    qualifiedCount: 1,
    repeatEvery: 1,
    rewards: [
      { rewardType: "PREMIUM_DAYS", quantity: 7 },
      { rewardType: "FRIEND_SLOT", quantity: 1 },
    ],
  },
  { qualifiedCount: 3, repeatEvery: null, rewards: [{ rewardType: "PREMIUM_DAYS", quantity: 14 }] },
  { qualifiedCount: 5, repeatEvery: 5, rewards: [{ rewardType: "FRIEND_SLOT", quantity: 2 }] },
] as const satisfies readonly InviterRewardMilestone[];

describe("invite-reward — 초대 보상 계산", () => {
  describe("isMilestoneReachedAt", () => {
    it.each([
      { count: 4, expected: false },
      { count: 5, expected: true },
      { count: 9, expected: false },
      { count: 10, expected: true },
    ])("5명부터 5명마다 반복하는 단계는 $count명일 때 $expected다", ({ count, expected }) => {
      // Given
      const milestone = MILESTONES[2];

      // When
      const reached = isMilestoneReachedAt(milestone, count);

      // Then
      expect(reached).toBe(expected);
    });
  });

  describe("nextMilestone", () => {
    it("다음 지점의 모든 단계 보상을 종류별로 합쳐 보여 준다", () => {
      // Given
      const qualifiedCount = 2;

      // When
      const next = nextInviteMilestone(qualifiedCount, MILESTONES);

      // Then
      expect(next).toEqual({
        qualifiedCount: 3,
        rewards: [
          { rewardType: "PREMIUM_DAYS", quantity: 21 },
          { rewardType: "FRIEND_SLOT", quantity: 1 },
        ],
      });
    });

    it("반복 단계가 없고 모든 단계를 지나면 null을 반환한다", () => {
      // Given
      const milestones = [MILESTONES[1]];

      // When
      const next = nextMilestoneQualifiedCount(milestones, 3);

      // Then
      expect(next).toBeNull();
    });
  });

  describe("summarize", () => {
    it("상한은 보류 중 지급까지 세고, 받은 보상은 적용된 지급만 종류별로 보여 준다", () => {
      // Given
      const totals = [
        {
          rewardType: "PREMIUM_DAYS" as const,
          quantityInWindow: 14,
          totalQuantity: 21,
          appliedQuantity: 14,
        },
        {
          rewardType: "FRIEND_SLOT" as const,
          quantityInWindow: 2,
          totalQuantity: 3,
          appliedQuantity: 0,
        },
      ];

      // When
      const summary = summarizeInviterRewards(totals);

      // Then
      expect(summary).toEqual({
        premiumDaysInWindow: 14,
        totalPremiumDays: 21,
        rewardsEarned: [{ rewardType: "PREMIUM_DAYS", quantity: 14 }],
      });
    });

    it("받은 보상이 없으면 0과 빈 목록이다", () => {
      // Given
      const totals: Parameters<typeof summarizeInviterRewards>[0] = [];

      // When
      const summary = summarizeInviterRewards(totals);

      // Then
      expect(summary).toEqual({ premiumDaysInWindow: 0, totalPremiumDays: 0, rewardsEarned: [] });
    });
  });

  describe("rewardCapWindowStart", () => {
    it("윤년 2월을 지나 3월 15일의 30일 전은 2월 14일이다", () => {
      // Given
      const now = Temporal.Instant.from("2028-03-15T00:00:00Z");

      // When
      const start = rewardCapWindowStart(now);

      // Then
      expect(start.toString()).toBe("2028-02-14T00:00:00Z");
    });
  });

  describe("premiumCapState", () => {
    it.each([
      { inWindow: 0, total: 0, expected: "AVAILABLE" },
      { inWindow: 29, total: 29, expected: "AVAILABLE" },
      { inWindow: 30, total: 30, expected: "WINDOW_REACHED" },
      { inWindow: 30, total: 89, expected: "WINDOW_REACHED" },
      { inWindow: 7, total: 90, expected: "TOTAL_REACHED" },
      { inWindow: 30, total: 90, expected: "TOTAL_REACHED" },
    ])("최근 30일 $inWindow일·누적 $total일이면 $expected다", ({ inWindow, total, expected }) => {
      // Given
      const summary = { premiumDaysInWindow: inWindow, totalPremiumDays: total };

      // When
      const state = premiumCapState(summary);

      // Then 누적 상한(90)이 최근 30일 상한(30)보다 먼저다
      expect(state).toBe(expected);
    });

    it("최근 30일 상한에 닿았던 지급이 기간 밖으로 빠지면 다시 AVAILABLE이다", () => {
      // Given 30일을 받은 뒤 rolling 기간이 지나 기간 안 지급이 0이 됐다
      const reached = { premiumDaysInWindow: 30, totalPremiumDays: 30 };
      const afterWindow = { premiumDaysInWindow: 0, totalPremiumDays: 30 };

      // When
      const states = [premiumCapState(reached), premiumCapState(afterWindow)];

      // Then
      expect(states).toEqual(["WINDOW_REACHED", "AVAILABLE"]);
    });
  });

  describe("remainingPremiumDays", () => {
    it.each([
      { inWindow: 28, total: 28, expected: 2 },
      { inWindow: 30, total: 30, expected: 0 },
      { inWindow: 7, total: 88, expected: 2 },
      { inWindow: 0, total: 90, expected: 0 },
    ])("월 $inWindow일·누적 $total일이면 $expected일 남는다", ({ inWindow, total, expected }) => {
      // Given
      const summary = { premiumDaysInWindow: inWindow, totalPremiumDays: total, rewardsEarned: [] };

      // When
      const remaining = remainingPremiumDays(summary);

      // Then
      expect(remaining).toBe(expected);
    });
  });

  describe("planInviterRewards", () => {
    const redemptionId = InviteRedemptionId.reconstitute("redemption-9");
    const inviterId = UserId.reconstitute("inviter-1");

    function plan(premiumDaysInWindow: number, totalPremiumDays: number) {
      return planInviterRewards({
        redemptionId,
        inviterId,
        summary: { premiumDaysInWindow, totalPremiumDays, rewardsEarned: [] },
        priorQualifiedCount: 4,
      });
    }

    it("최근 30일에 28일을 받았으면 남은 2일과 친구 자리를 계획한다", () => {
      // Given
      const premiumDaysInWindow = 28;

      // When
      const plans = plan(premiumDaysInWindow, 28);

      // Then
      expect(plans).toEqual([
        {
          recipientId: inviterId,
          sourceType: "INVITE_REDEMPTION",
          sourceId: "redemption-9",
          rewardType: "PREMIUM_DAYS",
          quantity: 2,
        },
        {
          recipientId: inviterId,
          sourceType: "INVITE_REDEMPTION",
          sourceId: "redemption-9",
          rewardType: "FRIEND_SLOT",
          quantity: 1,
        },
      ]);
    });

    it.each([
      { name: "최근 30일 30일을 모두 받은", inWindow: 30, total: 30 },
      { name: "누적 90일을 모두 받은", inWindow: 0, total: 90 },
    ])("$name 초대한 사람에게는 프리미엄 없이 친구 자리만 계획한다", ({ inWindow, total }) => {
      // Given
      const summary = { inWindow, total };

      // When
      const plans = plan(summary.inWindow, summary.total);

      // Then
      expect(plans.map((item) => [item.rewardType, item.quantity])).toEqual([["FRIEND_SLOT", 1]]);
    });
  });

  describe("capRewards", () => {
    it.each([
      {
        remaining: 7,
        expected: [
          { rewardType: "PREMIUM_DAYS", quantity: 7 },
          { rewardType: "FRIEND_SLOT", quantity: 1 },
        ],
      },
      {
        remaining: 3,
        expected: [
          { rewardType: "PREMIUM_DAYS", quantity: 3 },
          { rewardType: "FRIEND_SLOT", quantity: 1 },
        ],
      },
      { remaining: 0, expected: [{ rewardType: "FRIEND_SLOT", quantity: 1 }] },
    ])("남은 프리미엄 $remaining일이면 프리미엄만 그만큼 줄인다", ({ remaining, expected }) => {
      // Given
      const rewards = MILESTONES[0].rewards;

      // When
      const capped = capRewards(rewards, remaining);

      // Then
      expect(capped).toEqual(expected);
    });
  });

  describe("planInviteeRewards", () => {
    it.each([
      { isRewardClaimed: true, expectedPlans: [["PREMIUM_DAYS", 7]] },
      { isRewardClaimed: false, expectedPlans: [] },
    ])(
      "같은 기기·신원으로 처음 받는지가 $isRewardClaimed이면 초대받은 사람 보상은 $expectedPlans다",
      ({ isRewardClaimed, expectedPlans }) => {
        // Given
        const inviteeId = UserId.reconstitute("invitee-9");

        // When
        const { rewards, plans } = planInviteeRewards({
          redemptionId: InviteRedemptionId.reconstitute("redemption-9"),
          inviteeId,
          isRewardClaimed,
        });

        // Then
        expect(plans.map((plan) => [plan.rewardType, plan.quantity])).toEqual(expectedPlans);
        expect(rewards.map((reward) => [reward.rewardType, reward.quantity])).toEqual(
          expectedPlans,
        );
        expect(plans.every((plan) => plan.recipientId.equals(inviteeId))).toBe(true);
      },
    );
  });

  describe("rewardsAtQualifiedCount", () => {
    it("같은 지점에 도달한 단계가 없으면 빈 보상이다", () => {
      // Given
      const milestones = [MILESTONES[1]];

      // When
      const rewards = rewardsAtQualifiedCount(milestones, 2);

      // Then
      expect(rewards).toEqual([]);
    });
  });
});
