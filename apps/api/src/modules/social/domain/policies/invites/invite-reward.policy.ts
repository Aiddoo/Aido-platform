import type { InviterRewardMilestone, RewardAmount } from "@aido/api";
import {
  INVITE_REWARD_CAPS,
  INVITER_REWARD_MILESTONES,
  REWARD_TYPE,
  type RewardType,
} from "@aido/api/vocabulary";
import { sumBy } from "es-toolkit";

import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";

/** 월 상한(PREMIUM_DAYS_PER_30_DAYS)을 세는 rolling 기간. UTC 시각 기준이다. */
const INVITE_REWARD_CAP_WINDOW_DAYS = 30;

/** 초대한 사람으로 받은 보상의 종류별 합계. 저장소가 집계 한 번으로 만든다. */
export interface InviterRewardTotal {
  readonly rewardType: RewardType;
  /** rewardCapWindowStart 이후에 기록된 지급. 적용 전·재시도 중인 지급도 포함한다. */
  readonly quantityInWindow: number;
  readonly totalQuantity: number;
  readonly appliedQuantity: number;
}

export interface InviterRewardSummary {
  /** 상한 판단용. 적용 전·실패 후 재시도 중인 지급도 포함한다. */
  readonly premiumDaysInWindow: number;
  readonly totalPremiumDays: number;
  /** 실제 적용된 보상의 종류별 합계 */
  readonly rewardsEarned: readonly RewardAmount[];
}

export interface InviteMilestoneView {
  readonly qualifiedCount: number;
  readonly rewards: readonly RewardAmount[];
}

/** 첫 도달 지점과, 반복 단계면 그 뒤 repeatEvery명마다 보상한다. */
export function isMilestoneReachedAt(
  milestone: InviterRewardMilestone,
  qualifiedCount: number,
): boolean {
  if (qualifiedCount === milestone.qualifiedCount) return true;
  return (
    milestone.repeatEvery !== null &&
    qualifiedCount > milestone.qualifiedCount &&
    (qualifiedCount - milestone.qualifiedCount) % milestone.repeatEvery === 0
  );
}

/** 같은 지점에 도달한 단계들의 보상을 종류별로 합친다. */
export function rewardsAtQualifiedCount(
  milestones: readonly InviterRewardMilestone[],
  qualifiedCount: number,
): RewardAmount[] {
  return sumRewards(
    milestones
      .filter((milestone) => isMilestoneReachedAt(milestone, qualifiedCount))
      .flatMap((milestone) => milestone.rewards),
  );
}

/** 지금보다 큰 가장 가까운 보상 지점. 더 받을 단계가 없으면 null이다. */
export function nextMilestoneQualifiedCount(
  milestones: readonly InviterRewardMilestone[],
  qualifiedCount: number,
): number | null {
  const candidates = milestones.flatMap((milestone) => {
    if (milestone.qualifiedCount > qualifiedCount) return [milestone.qualifiedCount];
    if (milestone.repeatEvery === null) return [];
    const passed = qualifiedCount - milestone.qualifiedCount;
    return [qualifiedCount + milestone.repeatEvery - (passed % milestone.repeatEvery)];
  });
  return candidates.length === 0 ? null : Math.min(...candidates);
}

/** 사용 시작한 친구 수에는 보상 지급까지 끝난 친구도 들어간다. */
export function qualifiedRedemptionCount(counts: {
  readonly qualifiedCount: number;
  readonly rewardedCount: number;
}): number {
  return counts.qualifiedCount + counts.rewardedCount;
}

/** 이 시각보다 뒤에 기록된 지급이 최근 30일 상한에 들어간다. */
export function rewardCapWindowStart(now: Date): Date {
  return subtractDays(INVITE_REWARD_CAP_WINDOW_DAYS, now);
}

/** 월 상한과 누적 상한 중 남은 쪽만큼만 더 지급할 수 있다. */
export function remainingPremiumDays(summary: InviterRewardSummary): number {
  return Math.max(
    0,
    Math.min(
      INVITE_REWARD_CAPS.PREMIUM_DAYS_PER_30_DAYS - summary.premiumDaysInWindow,
      INVITE_REWARD_CAPS.PREMIUM_DAYS_TOTAL - summary.totalPremiumDays,
    ),
  );
}

function sumRewards(rewards: readonly RewardAmount[]): RewardAmount[] {
  return Object.values(REWARD_TYPE).flatMap((rewardType) => {
    const quantity = sumBy(
      rewards.filter((reward) => reward.rewardType === rewardType),
      (reward) => reward.quantity,
    );
    return quantity > 0 ? [{ rewardType, quantity }] : [];
  });
}

export const InviteRewardPolicy = {
  summarize(totals: readonly InviterRewardTotal[]): InviterRewardSummary {
    const premium = totals.filter((total) => total.rewardType === REWARD_TYPE.PREMIUM_DAYS);
    return {
      premiumDaysInWindow: sumBy(premium, (total) => total.quantityInWindow),
      totalPremiumDays: sumBy(premium, (total) => total.totalQuantity),
      rewardsEarned: sumRewards(
        totals.map((total) => ({ rewardType: total.rewardType, quantity: total.appliedQuantity })),
      ),
    };
  },

  nextMilestone(
    qualifiedCount: number,
    milestones: readonly InviterRewardMilestone[] = INVITER_REWARD_MILESTONES,
  ): InviteMilestoneView | null {
    const next = nextMilestoneQualifiedCount(milestones, qualifiedCount);
    if (next === null) return null;
    return { qualifiedCount: next, rewards: rewardsAtQualifiedCount(milestones, next) };
  },
};
