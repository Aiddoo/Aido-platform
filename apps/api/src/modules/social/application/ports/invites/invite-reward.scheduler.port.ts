/** 보상 지급 작업을 만든 계기. 같은 수락의 같은 계기는 작업 하나로 합친다. */
export type InviteRewardTrigger =
  | { readonly kind: "redeemed" }
  | { readonly kind: "qualified" }
  | { readonly kind: "retry"; readonly localDate: string };

export const INVITE_REWARD_SCHEDULER = Symbol("INVITE_REWARD_SCHEDULER");

export interface InviteRewardSchedulerPort {
  /** 활성 UoW 안에서 부르면 지급 원장과 함께 커밋된다. */
  schedule(redemptionId: string, trigger: InviteRewardTrigger): Promise<void>;
  /** 여러 수락의 작업을 한 번에 만든다. */
  scheduleMany(redemptionIds: readonly string[], trigger: InviteRewardTrigger): Promise<void>;
}
