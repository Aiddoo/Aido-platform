import type { RewardGrant } from "../../domain/reward-grant.entity.js";

/** 지급 원장 한 건을 실제 혜택으로 바꾼다. 같은 지급을 다시 적용해도 한 번만 반영돼야 한다. */
export abstract class RewardApplierPort {
  /** 받는 사람이 없으면 USER_0601이다. */
  abstract apply(grant: RewardGrant): Promise<void>;
}
