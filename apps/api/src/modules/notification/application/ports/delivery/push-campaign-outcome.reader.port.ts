import type { PushDispatchSkipReason } from "@aido/api/vocabulary";

import type {
  PushDeliveryAttemptStatus,
  PushDispatchStatus,
} from "../../../domain/types/delivery/push-delivery-status.js";

export const PUSH_CAMPAIGN_OUTCOME_READER = Symbol("PUSH_CAMPAIGN_OUTCOME_READER");

/** 행이 없는 상태는 Map에 없다. */
export interface PushCampaignOutcome {
  readonly dispatches: ReadonlyMap<PushDispatchStatus, number>;
  readonly attempts: ReadonlyMap<PushDeliveryAttemptStatus, number>;
  /** SKIPPED 디스패치의 사유별 수. 어휘에 없는 옛 사유는 세지 않는다. */
  readonly skippedByReason: ReadonlyMap<PushDispatchSkipReason, number>;
}

export interface PushCampaignOutcomeReaderPort {
  summarize(campaignKey: string): Promise<PushCampaignOutcome>;
}
