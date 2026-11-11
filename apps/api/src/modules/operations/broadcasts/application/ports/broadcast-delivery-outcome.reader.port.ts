import type { PushCampaignOutcome } from "#api/modules/notification/notification-delivery.public";

export abstract class BroadcastDeliveryOutcomeReaderPort {
  abstract summarize(campaignKey: string): Promise<PushCampaignOutcome>;
}
