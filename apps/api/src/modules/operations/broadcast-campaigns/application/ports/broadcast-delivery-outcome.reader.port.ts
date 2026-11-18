import type { PushCampaignOutcome } from "#api/modules/notification/push-dispatches/notification-push-dispatches.public";

export abstract class BroadcastDeliveryOutcomeReaderPort {
  abstract summarize(campaignKey: string): Promise<PushCampaignOutcome>;
}
