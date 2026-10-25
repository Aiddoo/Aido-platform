import type { RewardType } from "@aido/api/vocabulary";

/** 보상 출처. 챌린지 같은 다른 출처는 값만 추가한다. */
export type RewardSourceType = "INVITE_REDEMPTION";

export type RewardGrantStatusValue = "PENDING" | "APPLIED" | "FAILED";

/** 지급 원장 한 건이 실제 혜택(보상 기간·리소스 보너스)으로 바뀔 때 쓰는 출처 키. 같은 지급은 한 번만 반영된다. */
export function rewardGrantSourceKey(rewardGrantId: string): string {
  return `reward-grant:${rewardGrantId}`;
}

/**
 * 이 횟수만큼 실패한 지급은 자동으로 다시 시도하지 않는다. 큐 재시도는 세지 않고 지급 작업의
 * 첫 실행(수락·사용 시작·하루 한 번 정비 재시도)마다 한 번 센다. 그래서 첫 실행과 정비 재시도 4일이다.
 */
export const INVITE_REWARD_MAX_ATTEMPTS = 5;

/** 지급 원장에 PENDING으로 남길 한 건. (출처, 받는 사람, 종류)마다 한 번만 저장된다. */
export interface RewardGrantPlan {
  readonly recipientId: string;
  readonly sourceType: RewardSourceType;
  readonly sourceId: string;
  readonly rewardType: RewardType;
  readonly quantity: number;
}
