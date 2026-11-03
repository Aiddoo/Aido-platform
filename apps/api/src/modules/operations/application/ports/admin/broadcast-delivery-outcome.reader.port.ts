import type { PushCampaignOutcome } from "#api/modules/notification/notification-delivery.public";

export const BROADCAST_DELIVERY_OUTCOME_READER = Symbol("BROADCAST_DELIVERY_OUTCOME_READER");

export interface BroadcastDeliveryOutcomeReaderPort {
  summarize(campaignKey: string): Promise<PushCampaignOutcome>;
}
