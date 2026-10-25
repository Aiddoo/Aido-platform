import type { RewardType } from "@aido/api/vocabulary";

/** 보상 출처. 챌린지 같은 다른 출처는 값만 추가한다. */
export type RewardSourceType = "INVITE_REDEMPTION";

export type RewardGrantStatusValue = "PENDING" | "APPLIED" | "FAILED";

/** 지급 원장 한 건이 실제 혜택(보상 기간·리소스 보너스)으로 바뀔 때 쓰는 출처 키. 같은 지급은 한 번만 반영된다. */
export function rewardGrantSourceKey(rewardGrantId: string): string {
  return `reward-grant:${rewardGrantId}`;
}

/** 지급 원장에 PENDING으로 남길 한 건. (출처, 받는 사람, 종류)마다 한 번만 저장된다. */
export interface RewardGrantPlan {
  readonly recipientId: string;
  readonly sourceType: RewardSourceType;
  readonly sourceId: string;
  readonly rewardType: RewardType;
  readonly quantity: number;
}
