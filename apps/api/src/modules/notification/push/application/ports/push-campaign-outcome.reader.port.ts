import type { PushDispatchSkipReason } from "@aido/api/vocabulary";

import type {
  PushDeliveryAttemptStatus,
  PushDispatchStatus,
} from "../../domain/push-delivery-status.constants.js";

// 다른 Context가 옮길 때까지 옛 Symbol을 같은 인스턴스의 별칭으로 남긴다
export const PUSH_CAMPAIGN_OUTCOME_READER = Symbol("PUSH_CAMPAIGN_OUTCOME_READER");

// 행이 없는 상태는 Map에 없다
export interface PushCampaignOutcome {
  readonly dispatches: ReadonlyMap<PushDispatchStatus, number>;
  readonly attempts: ReadonlyMap<PushDeliveryAttemptStatus, number>;
  // 어휘에 없는 옛 사유는 세지 않는다
  readonly skippedByReason: ReadonlyMap<PushDispatchSkipReason, number>;
}

export abstract class PushCampaignOutcomeReaderPort {
  abstract summarize(campaignKey: string): Promise<PushCampaignOutcome>;
}
