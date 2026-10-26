import type { RewardType } from "@aido/api/vocabulary";

import type { RewardGrantRecord } from "./reward-grant.repository.port.js";

/** 지급 원장 한 건을 실제 혜택으로 바꾼다. 같은 지급을 다시 적용해도 한 번만 반영돼야 한다. */
export interface RewardApplier {
  apply(grant: RewardGrantRecord): Promise<void>;
}

/** 새 보상 종류는 RewardType 값과 Applier 한 줄만 더한다. */
export type RewardApplierRegistry = Readonly<Record<RewardType, RewardApplier>>;

export const REWARD_APPLIERS = Symbol("REWARD_APPLIERS");
