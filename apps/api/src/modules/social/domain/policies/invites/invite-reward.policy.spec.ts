import type { InviterRewardMilestone } from "@aido/api";

import {
  type InviterRewardLedgerItem,
  InviteRewardPolicy,
  isMilestoneReachedAt,
  isWithinRewardCapWindow,
  nextMilestoneQualifiedCount,
  remainingPremiumDays,
} from "./invite-reward.policy.js";

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

function ledgerItem(overrides: Partial<InviterRewardLedgerItem>): InviterRewardLedgerItem {
  return {
    rewardType: "PREMIUM_DAYS",
    quantity: 7,
    status: "APPLIED",
    grantedAt: new Date("2028-02-15T00:00:00.000Z"),
    ...overrides,
  };
}

describe("InviteRewardPolicy", () => {
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
      const next = InviteRewardPolicy.nextMilestone(qualifiedCount, MILESTONES);

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

  describe("summarizeLedger", () => {
    it("최근 30일 상한은 보류 중 지급까지 세고, 받은 보상은 적용된 지급만 종류별로 합친다", () => {
      // Given
      const now = new Date("2028-03-15T00:00:00.000Z");
      const ledger = [
        ledgerItem({ grantedAt: new Date("2028-02-14T00:00:00.000Z") }),
        ledgerItem({ grantedAt: new Date("2028-02-15T00:00:00.000Z") }),
        ledgerItem({ status: "PENDING", grantedAt: new Date("2028-03-10T00:00:00.000Z") }),
        ledgerItem({ rewardType: "FRIEND_SLOT", quantity: 1 }),
      ];

      // When
      const summary = InviteRewardPolicy.summarizeLedger(ledger, now);

      // Then
      expect(summary).toEqual({
        premiumDaysInWindow: 14,
        totalPremiumDays: 21,
        rewardsEarned: [
          { rewardType: "PREMIUM_DAYS", quantity: 14 },
          { rewardType: "FRIEND_SLOT", quantity: 1 },
        ],
      });
    });
  });

  describe("isWithinRewardCapWindow", () => {
    it.each([
      { grantedAt: "2028-02-14T00:00:00.000Z", expected: false },
      { grantedAt: "2028-02-14T00:00:00.001Z", expected: true },
    ])(
      "윤년 2월을 지나 3월 15일 기준 $grantedAt 지급의 30일 포함 여부는 $expected다",
      ({ grantedAt, expected }) => {
        // Given
        const now = new Date("2028-03-15T00:00:00.000Z");

        // When
        const within = isWithinRewardCapWindow(new Date(grantedAt), now);

        // Then
        expect(within).toBe(expected);
      },
    );
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
});
