import { BroadcastJobEnqueuerPort } from "#api/modules/operations/broadcasts/application/ports/broadcast-job-enqueuer.port";
import type { BroadcastCampaignId } from "#api/modules/operations/broadcasts/domain/broadcast-campaign-id.vo";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export interface RecordedFanOut {
  readonly campaignId: string;
  readonly cursorUserId: string | null;
}

export interface RecordedDelivery {
  readonly campaignId: string;
  readonly startAfter: Temporal.Instant;
  readonly userIds: readonly string[];
}

export class RecordingBroadcastJobEnqueuer extends BroadcastJobEnqueuerPort {
  readonly fanOuts: RecordedFanOut[] = [];
  readonly deliveries: RecordedDelivery[] = [];

  async enqueueFanOut(input: {
    readonly campaignId: BroadcastCampaignId;
    readonly cursorUserId: UserId | null;
  }): Promise<void> {
    this.fanOuts.push({
      campaignId: input.campaignId.value,
      cursorUserId: input.cursorUserId?.value ?? null,
    });
  }

  async enqueueDelivery(input: {
    readonly campaignId: BroadcastCampaignId;
    readonly startAfter: Temporal.Instant;
    readonly userIds: readonly UserId[];
  }): Promise<void> {
    this.deliveries.push({
      campaignId: input.campaignId.value,
      startAfter: input.startAfter,
      userIds: input.userIds.map(({ value }) => value),
    });
  }
}
