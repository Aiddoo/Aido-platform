import type { RewardType } from "@aido/api/vocabulary";

export interface InviteRewardRetryExhausted {
  readonly grantId: string;
  readonly redemptionId: string;
  readonly rewardType: RewardType;
  readonly attempts: number;
  readonly errorCode: string;
}

export const INVITE_REWARD_ALERT = Symbol("INVITE_REWARD_ALERT");

/** 자동 재시도를 다 쓴 지급을 운영자가 볼 수 있게 알린다. 실패해도 지급 흐름에 전파하지 않는다. */
export interface InviteRewardAlertPort {
  reportRetryExhausted(failure: InviteRewardRetryExhausted): void;
}
