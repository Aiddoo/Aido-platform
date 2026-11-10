import type { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";

/** 보상 지급 작업을 만든 계기. 같은 수락의 같은 계기는 작업 하나로 합친다. */
export type InviteRewardTrigger =
  | { readonly kind: "redeemed" }
  | { readonly kind: "qualified" }
  | { readonly kind: "retry"; readonly runDate: Temporal.PlainDate };

export abstract class InviteRewardSchedulerPort {
  /** 활성 UoW 안에서 부르면 지급 원장과 함께 커밋된다. 작업 큐가 같은 DB transaction으로 작업을 쓰기 때문이다. */
  abstract schedule(redemptionId: InviteRedemptionId, trigger: InviteRewardTrigger): Promise<void>;
  abstract scheduleMany(
    redemptionIds: readonly InviteRedemptionId[],
    trigger: InviteRewardTrigger,
  ): Promise<void>;
}
