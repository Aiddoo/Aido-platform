import type {
  PushDeliveryAttemptStatus,
  PushDispatchStatus,
} from "../../../domain/types/delivery/push-delivery-status.js";

export const PUSH_CAMPAIGN_OUTCOME_READER = Symbol("PUSH_CAMPAIGN_OUTCOME_READER");

/** 행이 없는 상태는 Map에 없다. */
export interface PushCampaignOutcome {
  readonly dispatches: ReadonlyMap<PushDispatchStatus, number>;
  readonly attempts: ReadonlyMap<PushDeliveryAttemptStatus, number>;
}

export interface PushCampaignOutcomeReaderPort {
  summarize(campaignKey: string): Promise<PushCampaignOutcome>;
}
